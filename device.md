# ✅ Dual OLED Eyes + Split Soil & NPK Dashboard
# ✅ Single eye animation for all modes
# ✅ Upload icon + BLE mode control anytime
# ✅ BLE helper message stays ~1 min and repeats after disconnect
# ✅ SH1106_I2C compatible (uses .framebuf for rects)
# ✅ GNSS / GPS Integration (NEO-M9N on UART0) with Firebase & Terminal Logging

import uasyncio as asyncio
import aioble
import bluetooth
import network
import urequests
from machine import Pin, I2C, UART, unique_id
import time, math, struct
import sh1106
from ubx_config import configure_all

# -------------------- Config --------------------
FIREBASE_URL = "https://crave-be91e-default-rtdb.firebaseio.com"
FIREBASE_UPLOAD_URL = "https://asia-south1-crave-be91e.cloudfunctions.net/aimUpload"
UART_SERVICE_UUID = bluetooth.UUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
UART_RX_CHAR_UUID = bluetooth.UUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E")

# Pins
I2C0_SDA = 4
I2C0_SCL = 5
I2C1_SDA = 6
I2C1_SCL = 7

UART1_TX = 8
UART1_RX = 9

UART0_TX = 0
UART0_RX = 1

RS485_DE = 2
RS485_RE = 3

BTN1_PIN = 10
BTN2_PIN = 11
BTN3_PIN = 12
BTN4_PIN = 13

READ_ENV_CMD = bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x04, 0x44, 0x09])

# -------------------- Globals --------------------
mode = 0                     # 0 = idle, 1 = offline, 2/3 = online
wifi_ssid = None
wifi_password = None
_current_task = None
_status_lock = asyncio.Lock()

# GNSS / GPS Global Data
gps_data = {
    "lat": 0.0, "lon": 0.0, "status": "No Fix", "satellites": 0,
    "time": "00:00:00", "date": "00/00/0000",
    "height": 0.0, "hmsl": 0.0, "hacc": 0.0, "vacc": 0.0
}
gps_buffer = b""

# Device ID
chip_id = unique_id()
DEVICE_ID = chip_id.hex()[-4:].upper()
BLE_NAME = f"AIM-{DEVICE_ID}"
FIREBASE_PATH = f"{DEVICE_ID}.json"

# -------------------- Hardware Init --------------------
i2c_left = I2C(0, scl=Pin(I2C0_SCL), sda=Pin(I2C0_SDA), freq=400000)
i2c_right = I2C(1, scl=Pin(I2C1_SCL), sda=Pin(I2C1_SDA), freq=400000)

oled_left = sh1106.SH1106_I2C(128, 64, i2c_left)
oled_right = sh1106.SH1106_I2C(128, 64, i2c_right)

W, H = 128, 64
eye_radius = 28

DE = Pin(RS485_DE, Pin.OUT)
RE = Pin(RS485_RE, Pin.OUT)
uart = UART(1, baudrate=4800, tx=Pin(UART1_TX), rx=Pin(UART1_RX), timeout=200)

DE.value(0)
RE.value(0)

# GPS Setup
uart_gps = UART(0, baudrate=38400, tx=Pin(UART0_TX), rx=Pin(UART0_RX))
try:
    print("Initializing NEO-M9N UBX Configuration...")
    configure_all(uart_gps)
except Exception as e:
    print("GPS Configuration warning:", e)

btn1 = Pin(BTN1_PIN, Pin.IN, Pin.PULL_UP)
btn2 = Pin(BTN2_PIN, Pin.IN, Pin.PULL_UP)
btn3 = Pin(BTN3_PIN, Pin.IN, Pin.PULL_UP)
btn4 = Pin(BTN4_PIN, Pin.IN, Pin.PULL_UP)

uart_service = aioble.Service(UART_SERVICE_UUID)
rx_char = aioble.Characteristic(uart_service, UART_RX_CHAR_UUID, write_no_response=True, write=True)
aioble.register_services(uart_service)

# -------------------- Utility & Modbus --------------------

def rs485_send(command):
    DE.value(1)
    RE.value(1)
    uart.write(command)
    time.sleep(0.02)
    DE.value(0)
    RE.value(0)
    time.sleep(0.3)
    return uart.read()

def parse16(msb, lsb):
    val = (msb << 8) | lsb
    if val > 32767:
        val -= 65536
    return val

def modbus_crc(data):
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    return crc & 0xFFFF

def read_single_reg(reg_addr):
    hi = (reg_addr >> 8) & 0xFF
    lo = reg_addr & 0xFF
    frame = bytes([0x01, 0x03, hi, lo, 0x00, 0x01])
    crc = modbus_crc(frame)
    crc_lo = crc & 0xFF
    crc_hi = (crc >> 8) & 0xFF
    full_cmd = frame + bytes([crc_lo, crc_hi])
    resp = rs485_send(full_cmd)
    time.sleep(0.3)
    if resp and len(resp) >= 7:
        return parse16(resp[3], resp[4])
    return 0

def read_soil_sensor():
    resp1 = rs485_send(READ_ENV_CMD)
    moisture = temp = ec = ph = 0
    if resp1 and len(resp1) >= 11:
        moisture = parse16(resp1[3], resp1[4]) / 10.0
        temp = parse16(resp1[5], resp1[6]) / 10.0
        ec = parse16(resp1[7], resp1[8])
        ph = parse16(resp1[9], resp1[10]) / 10.0

    n = read_single_reg(0x0007)
    p = read_single_reg(0x0004)
    k = read_single_reg(0x0008)

    return {"moisture": moisture, "temp": temp, "ec": ec, "ph": ph, "n": n, "p": p, "k": k}

# -------------------- GPS Async Task --------------------
def update_gps():
    global gps_buffer, gps_data
    if uart_gps.any():
        gps_buffer += uart_gps.read()
        
        while True:
            start = gps_buffer.find(b'\xB5\x62')
            if start == -1:
                gps_buffer = b""
                break
            if len(gps_buffer) < start + 8:
                break

            msg_class = gps_buffer[start + 2]
            msg_id = gps_buffer[start + 3]
            length = struct.unpack('<H', gps_buffer[start + 4:start + 6])[0]
            packet_len = 6 + length + 2

            if len(gps_buffer) < start + packet_len:
                break

            packet = gps_buffer[start:start + packet_len]
            gps_buffer = gps_buffer[start + packet_len:]

            # Check for NAV-PVT message
            if msg_class == 0x01 and msg_id == 0x07:
                try:
                    payload = packet[6:-2]
                    year = struct.unpack('<H', payload[4:6])[0]
                    month = payload[6]
                    day = payload[7]
                    hour = payload[8]
                    minute = payload[9]
                    second = payload[10]

                    # UTC to IST conversion (+5h 30m)
                    minute += 30
                    if minute >= 60:
                        minute -= 60
                        hour += 1
                    hour += 5
                    if hour >= 24:
                        hour -= 24

                    fix_type = payload[20]
                    gps_data["satellites"] = payload[23]
                    gps_data["lon"] = struct.unpack('<i', payload[24:28])[0] / 10000000
                    gps_data["lat"] = struct.unpack('<i', payload[28:32])[0] / 10000000
                    
                    gps_data["height"] = struct.unpack('<i', payload[32:36])[0] / 1000
                    gps_data["hmsl"] = struct.unpack('<i', payload[36:40])[0] / 1000
                    gps_data["hacc"] = struct.unpack('<I', payload[40:44])[0] / 1000
                    gps_data["vacc"] = struct.unpack('<I', payload[44:48])[0] / 1000
                    
                    gps_data["date"] = f"{day:02d}/{month:02d}/{year}"
                    gps_data["time"] = f"{hour:02d}:{minute:02d}:{second:02d}"

                    if fix_type == 0: gps_data["status"] = "No Fix"
                    elif fix_type == 2: gps_data["status"] = "2D Fix"
                    elif fix_type == 3: gps_data["status"] = "3D Fix"
                    else: gps_data["status"] = "Other"

                except Exception as e:
                    print("GPS Decode Error:", e)

async def gps_background_task():
    """Background task to continuously poll UART0 for GPS packets."""
    while True:
        update_gps()
        await asyncio.sleep(0.05)

# -------------------- Terminal Reporting --------------------
def print_terminal_report(soil_data):
    print("\n=================== SYSTEM REPORT ===================")
    print(f"Timestamp (IST): {gps_data['date']} | {gps_data['time']}")
    print("-------------------- GPS DATA --------------------")
    print(f"Fix Status : {gps_data['status']}")
    print(f"Satellites : {gps_data['satellites']}")
    print(f"Latitude   : {gps_data['lat']:.7f}")
    print(f"Longitude  : {gps_data['lon']:.7f}")
    print(f"Altitude   : {gps_data['hmsl']:.2f} m (MSL)")
    print(f"Accuracy   : Horiz: {gps_data['hacc']:.2f}m | Vert: {gps_data['vacc']:.2f}m")
    print("------------------- SOIL DATA --------------------")
    print(f"Temperature: {soil_data['temp']:.1f} C         | Moisture : {soil_data['moisture']:.1f} %")
    print(f"Soil pH    : {soil_data['ph']:.1f}            | Soil EC  : {soil_data['ec']} us/cm")
    print(f"Nitrogen(N): {soil_data['n']} mg/kg      | Phosphorus(P): {soil_data['p']} mg/kg")
    print(f"Potassium(K): {soil_data['k']} mg/kg")
    print("=====================================================")

# -------------------- Display & Eye Drawing --------------------
def draw_filled_circle(fb, cx, cy, r):
    for dy in range(-r, r + 1):
        y = cy + dy
        v = r*r - dy*dy
        if v >= 0 and 0 <= y < H:
            dx = int(math.sqrt(v))
            fb.fill_rect(cx - dx, y, 2*dx + 1, 1, 1)

def draw_eye_fb(fb, cx, cy, r, pupil_dx=0, pupil_dy=0, open_frac=1.0):
    fb.fill(0)
    draw_filled_circle(fb, cx + pupil_dx, cy + pupil_dy, r)
    draw_filled_circle(fb, cx + pupil_dx, cy + pupil_dy, r - 5)
    if open_frac > 0.15:
        pr = max(3, int(r * 0.35))
        draw_filled_circle(fb, cx + pupil_dx, cy + pupil_dy, pr)
    cover = int((1.0 - open_frac) * r)
    if cover > 0:
        fb.fill_rect(cx - r, cy - r, 2*r, cover, 0)
        fb.fill_rect(cx - r, cy + r - cover + 1, 2*r, cover, 0)

async def blink_both():
    for i in range(8):
        f = 1 - (i/8)**2
        draw_eye_fb(oled_left.framebuf, 64, 32, eye_radius, open_frac=f)
        draw_eye_fb(oled_right.framebuf, 64, 32, eye_radius, open_frac=f)
        oled_left.show(); oled_right.show()
        await asyncio.sleep(0.04)
    for i in range(8):
        f = (i/8)**2
        draw_eye_fb(oled_left.framebuf, 64, 32, eye_radius, open_frac=f)
        draw_eye_fb(oled_right.framebuf, 64, 32, eye_radius, open_frac=f)
        oled_left.show(); oled_right.show()
        await asyncio.sleep(0.04)

async def move_eyes_once(direction="center", hold=0.6):
    dx = {"left": -8, "center": 0, "right": 8}.get(direction, 0)
    draw_eye_fb(oled_left.framebuf, 64, 32, eye_radius, pupil_dx=dx)
    draw_eye_fb(oled_right.framebuf, 64, 32, eye_radius, pupil_dx=-dx)
    oled_left.show(); oled_right.show()
    await asyncio.sleep(hold)

async def show_split_dashboard(data):
    oled_left.fill(0)
    oled_left.text("SOIL ENV", 0, 0, 1)
    oled_left.framebuf.fill_rect(0, 10, 128, 1, 1)
    oled_left.text("Temp:", 5, 20, 1)
    oled_left.text(f"{data['temp']:.1f} C", 70, 20, 1)
    oled_left.text("Moist:", 5, 35, 1)
    oled_left.text(f"{data['moisture']:.1f} %", 70, 35, 1)
    oled_left.show()

    oled_right.fill(0)
    oled_right.text("NPK & PH", 0, 0, 1)
    oled_right.framebuf.fill_rect(0, 10, 128, 1, 1)
    oled_right.text(f"N:{data['n']}", 0, 20, 1)
    oled_right.text(f"P:{data['p']}", 50, 20, 1)
    oled_right.text(f"K:{data['k']}", 0, 35, 1)
    oled_right.text(f"pH:{data['ph']:.1f}", 50, 35, 1)
    oled_right.text(f"EC:{data['ec']}", 0, 50, 1)
    oled_right.show()

async def show_status_line(line1, line2=""):
    async with _status_lock:
        oled_left.framebuf.fill_rect(0, 0, 128, 12, 0)
        oled_left.text(line1[:20], 0, 0, 1)
        if line2:
            oled_left.text(line2[:20], 0, 8, 1)
        oled_left.show()

async def show_ble_disconnected_screen(duration=60):
    start = time.time()
    while time.time() - start < duration:
        oled_left.fill(0)
        oled_left.text("BLE", 48, 10, 1)
        oled_left.text("DISCONNECTED", 4, 28, 1)
        oled_left.text("Waiting...", 20, 44, 1)
        oled_left.show()

        oled_right.fill(0)
        oled_right.text("ID:", 0, 10, 1)
        oled_right.text(DEVICE_ID, 30, 10, 1)
        oled_right.text("Open AIM App", 6, 30, 1)
        oled_right.text("Reconnect BLE", 2, 44, 1)
        oled_right.show()

        await asyncio.sleep(1)

def show_mode_info_right(mode_val, source="BLE"):
    oled_right.fill(0)
    oled_left.fill(0)
    if mode_val == 1:
        oled_right.text("MODE 1", 28, 8, 1)
        oled_right.text("Offline", 28, 24, 1)
        oled_right.text("Local data", 16, 36, 1)
    elif mode_val == 2:
        oled_right.text("MODE 2", 28, 8, 1)
        oled_right.text("WiFi+Cloud", 8, 24, 1)
        oled_right.text("Every 10s", 20, 36, 1)
    elif mode_val == 3:
        oled_right.text("MODE 3", 28, 8, 1)
        oled_right.text("WiFi+Cloud", 8, 24, 1)
        oled_right.text("Every 30s", 20, 36, 1)
    else:
        oled_right.text("AIM Paused", 16, 16, 1)
        oled_right.text("Mode=0", 32, 32, 1)
    oled_right.text(source, 0, 56, 1)
    oled_right.show()

def show_ble_screen(title, subtitle=""):
    oled_left.fill(0)
    oled_left.text("BLE STATUS", 12, 0, 1)
    oled_left.framebuf.fill_rect(0, 10, 128, 1, 1)
    oled_left.text(title[:14], 8, 24, 1)
    if subtitle:
        oled_left.text(subtitle[:16], 4, 40, 1)
    oled_left.show()

    oled_right.fill(0)
    oled_right.text("Use AIM App", 8, 16, 1)
    oled_right.text("to control", 12, 32, 1)
    oled_right.text("ID: " + DEVICE_ID, 60, 50, 1)
    oled_right.show()

def draw_upload_icon(color):
    fb = oled_right.framebuf
    x, y = 118, 2
    fb.pixel(x,   y+3, color)
    fb.pixel(x,   y+2, color)
    fb.pixel(x,   y+1, color)
    fb.pixel(x,   y,   color)
    fb.pixel(x-1, y+1, color)
    fb.pixel(x+1, y+1, color)

async def upload_icon_pulse():
    for _ in range(3):
        draw_upload_icon(1)
        oled_right.show()
        await asyncio.sleep(0.1)
        draw_upload_icon(0)
        oled_right.show()
        await asyncio.sleep(0.06)

# -------------------- Startup Visual Experience --------------------
async def startup_sequence():
    oled_left.fill(0); oled_left.show()
    oled_right.fill(0); oled_right.show()

    await blink_both()
    await move_eyes_once("left", 0.5)
    await move_eyes_once("right", 0.5)
    await blink_both()

    draw_eye_fb(oled_left.framebuf, 64, 32, eye_radius, open_frac=1.0)
    draw_eye_fb(oled_right.framebuf, 64, 32, eye_radius, open_frac=1.0)
    oled_left.show(); oled_right.show()
    await asyncio.sleep(0.6)

    oled_left.fill(0)
    oled_left.text("AIM is LIVE", 15, 30, 1)
    oled_left.show()

    oled_right.fill(0)
    oled_right.text("Hi User,", 28, 16, 1)
    oled_right.text("Welcome to", 16, 30, 1)
    oled_right.text("AIM :)", 36, 44, 1)
    oled_right.show()

    await asyncio.sleep(2.5)

# -------------------- Networking & Firebase --------------------
async def connect_wifi():
    global wifi_ssid, wifi_password
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wifi_ssid:
        oled_left.fill(0)
        await show_status_line("No Wi-Fi creds", "")
        oled_left.text("Update", 44, 14, 1)
        oled_left.text("it from the App", 8, 30, 1)
        oled_left.text("and come back!", 15, 46, 1)
        oled_left.show()
        await asyncio.sleep(0.12)
        return False

    if wlan.isconnected():
        ip = wlan.ifconfig()[0]
        await show_status_line("Wi-Fi already", ip)
        return True

    wlan.connect(wifi_ssid, wifi_password)
    for _ in range(20):
        if wlan.isconnected():
            ip = wlan.ifconfig()[0]
            if ip != "0.0.0.0":
                await show_status_line("Wi-Fi OK", ip)
                return True
        await asyncio.sleep(0.5)

    await show_status_line("Wi-Fi FAIL", "")
    return False

def upload_firebase(data):
    """Pushes combined Soil + GNSS payload to Realtime DB."""
    try:
        url = f"{FIREBASE_URL}/{FIREBASE_PATH}"
        payload = data.copy()
        payload["gps"] = {
            "latitude": gps_data["lat"],
            "longitude": gps_data["lon"],
            "altitude": gps_data["hmsl"],
            "satellites": gps_data["satellites"],
            "status": gps_data["status"],
            "timestamp": f"{gps_data['date']} {gps_data['time']}"
        }
        res = urequests.put(url, json=payload)
        res.close()
    except Exception as e:
        print("Firebase RTDB Error:", e)

def upload_firebase1(data):
    """Pushes combined Soil + GNSS payload to Cloud Function."""
    try:
        payload = {
            "deviceId": DEVICE_ID,
            "data": {
                "moisture": data["moisture"],
                "temperature": data["temp"],
                "ec": data["ec"],
                "ph": data["ph"],
                "n": data["n"],
                "p": data["p"],
                "k": data["k"],
                "latitude": gps_data["lat"],
                "longitude": gps_data["lon"],
                "altitude": gps_data["hmsl"],
                "satellites": gps_data["satellites"],
                "status": gps_data["status"],
                "gps_time": gps_data["time"],
                "gps_date": gps_data["date"]
            }
        }

        r = urequests.post(FIREBASE_UPLOAD_URL, json=payload)
        r.close()
    except Exception as e:
        print("Cloud upload error:", e)

# -------------------- Mode Management --------------------
async def set_mode(new_mode, source="SYS"):
    global mode, _current_task
    mode = new_mode

    if _current_task:
        _current_task.cancel()
        _current_task = None

    if new_mode == 1:
        _current_task = asyncio.create_task(mode_1_task_runner())
    elif new_mode == 2:
        _current_task = asyncio.create_task(mode_2_task_runner())
    elif new_mode == 3:
        _current_task = asyncio.create_task(mode_3_task_runner())

    if new_mode == 0:
        await show_status_line("Stopped", source)
        await asyncio.sleep(3)
        asyncio.create_task(idle_anim())
    else:
        await show_status_line(f"Mode {new_mode}", source)
        show_mode_info_right(new_mode, source)

# -------------------- Mode Runners --------------------
async def mode_1_task_runner():
    """Offline mode: dashboard + terminal reporting."""
    await show_status_line("Mode 1", "")
    show_mode_info_right(1, "RUN")
    while mode == 1:
        data = read_soil_sensor()
        await show_split_dashboard(data)
        await show_status_line("MODE 1")
        print_terminal_report(data)

        await asyncio.sleep(10)
        await blink_both()
        await move_eyes_once("left", 0.4)
        await move_eyes_once("right", 0.4)
        await blink_both()
        await asyncio.sleep(2)

async def mode_2_task_runner():
    """Online mode, 10s upload + GNSS telemetry."""
    if not await connect_wifi():
        return
    await show_status_line("Mode 2", "")
    show_mode_info_right(2, "RUN")
    while mode == 2:
        data = read_soil_sensor()
        await show_split_dashboard(data)
        await show_status_line("MODE 2")
        print_terminal_report(data)

        await upload_icon_pulse()
        upload_firebase(data)
        upload_firebase1(data)
        await asyncio.sleep(10)

        await blink_both()
        await move_eyes_once("left", 0.3)
        await move_eyes_once("right", 0.3)
        await blink_both()

async def mode_3_task_runner():
    """Online mode, 30s upload + GNSS telemetry."""
    if not await connect_wifi():
        return
    await show_status_line("Mode 3", "")
    show_mode_info_right(3, "RUN")
    while mode == 3:
        data = read_soil_sensor()
        await show_split_dashboard(data)
        await show_status_line("MODE 3")
        print_terminal_report(data)

        await upload_icon_pulse()
        upload_firebase(data)
        upload_firebase1(data)
        await asyncio.sleep(30)

        await blink_both()
        await move_eyes_once("left", 0.4)
        await move_eyes_once("right", 0.4)
        await blink_both()

def button_pressed():
    return not btn1.value() or not btn2.value() or not btn3.value() or not btn4.value()

# -------------------- BLE Loop --------------------
async def wait_for_ble_or_offline():
    global mode

    oled_left.fill(0)
    oled_left.text("Waiting for", 16, 24, 1)
    oled_left.text("Registration", 16, 36, 1)
    oled_left.show()

    oled_right.fill(0)
    oled_right.text("ID: " + DEVICE_ID, 10, 10, 1)
    oled_right.text("BLE Ready", 16, 26, 1)
    oled_right.show()
    await asyncio.sleep(5)

    show_ble_screen("Advertising", f"Scan {BLE_NAME}")
    await show_status_line("BLE Adv...", "")

    while True:
        if button_pressed():
            mode = 1
            print("🔘 Button: OFFLINE mode requested")
            return None

        try:
            conn = await aioble.advertise(
                1000,
                name=BLE_NAME,
                services=[UART_SERVICE_UUID],
            )
            if conn is not None and conn.is_connected():
                print("✅ BLE connected")
                return conn
        except Exception as e:
            print("BLE advertise error:", e)

async def ble_loop():
    global wifi_ssid, wifi_password, mode
    conn = None

    while True:
        if mode == 1:
            oled_left.fill(0)
            oled_left.text("Offline Mode", 10, 24, 1)
            oled_left.text("No BLE", 28, 36, 1)
            oled_left.show()

            oled_right.fill(0)
            oled_right.text("ID: " + DEVICE_ID, 10, 28, 1)
            oled_right.show()

            if button_pressed():
                print("🔘 Button: back to BLE registration (mode 0)")
                mode = 0

            await asyncio.sleep(0.3)
            continue

        if mode == 0 and (conn is None or not conn.is_connected()):
            conn = await wait_for_ble_or_offline()

            if mode == 1 or conn is None:
                continue

        if conn and conn.is_connected():
            oled_left.fill(0)
            oled_left.text("BLE Connected", 4, 24, 1)
            oled_left.text("Use App", 24, 36, 1)
            oled_left.show()

            oled_right.fill(0)
            oled_right.text("ID: " + DEVICE_ID, 10, 20, 1)
            oled_right.text("Ready", 34, 36, 1)
            oled_right.show()

            try:
                ble_rx_buffer = ""
                while conn.is_connected():
                    await rx_char.written()
                    raw = rx_char.read()
                    if not raw:
                        continue
                    
                    try:
                        decoded = raw.decode()
                        ble_rx_buffer += decoded
                        
                        if "\n" in ble_rx_buffer:
                            lines = ble_rx_buffer.split("\n")
                            ble_rx_buffer = lines.pop() 
                            
                            for msg in lines:
                                msg = msg.strip()
                                if not msg: continue
                                
                                print("📥 BLE RX (Processed):", msg)
                                
                                if msg in ("0", "1", "2", "3"):
                                    await set_mode(int(msg), "BLE")
                                    await show_status_line("Mode from BLE", f"Mode: {msg}")
                                    
                                elif ";" in msg:
                                    parts = msg.split(";", 1)
                                    wifi_ssid = parts[0]
                                    wifi_password = parts[1]
                                    
                                    print(f"📶 Wi-Fi: {wifi_ssid}")
                                    print(f"🔑 Pass Len: {len(wifi_password)}")

                                    await show_status_line("Wi-Fi updated", wifi_ssid[:16])
                                else:
                                    print("❓ Unknown BLE cmd:", msg)
                                     
                    except Exception as e:
                        print("Decoding error:", e)
                        ble_rx_buffer = ""

            except Exception as e:
                print("BLE RX loop error:", e)

            finally:
                if conn and conn.is_connected():
                    try:
                        await conn.disconnect()
                        await show_ble_disconnected_screen(60)
                    except Exception as e:
                        print("Disconnect exception:", e)

                conn = None

                if mode != 1:
                    mode = 0
        else:
            await asyncio.sleep(0.2)

# -------------------- Button Monitor --------------------
async def monitor_buttons():
    last = [1, 1, 1, 1]
    while True:
        vals = [btn1.value(), btn2.value(), btn3.value(), btn4.value()]
        for i, (o, n) in enumerate(zip(last, vals)):
            if o == 1 and n == 0:
                new_mode = i + 1 if i < 3 else 0
                await set_mode(new_mode, "BTN")
                await asyncio.sleep_ms(150)
        last = vals
        await asyncio.sleep(0.12)

# -------------------- Idle Animation --------------------
async def idle_anim():
    while True:
        if mode == 0:
            await blink_both()
            await move_eyes_once("left", 0.6)
            await move_eyes_once("right", 0.6)
            await blink_both()
        await asyncio.sleep(1)

# -------------------- Main --------------------
async def main():
    global _current_task

    await startup_sequence()

    # Start non-blocking background tasks
    asyncio.create_task(gps_background_task())
    asyncio.create_task(ble_loop())
    await asyncio.sleep(2)
    asyncio.create_task(monitor_buttons())

    _current_task = None

    while True:
        await asyncio.sleep(3600)

try:
    asyncio.run(main())
except Exception as e:
    oled_left.fill(0); oled_left.show()
    oled_right.fill(0); oled_right.show()
    print("Error:", e)