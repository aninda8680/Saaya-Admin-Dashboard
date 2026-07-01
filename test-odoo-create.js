// Env variables are loaded natively via Node.js --env-file flag

// Env variables are loaded natively via Node.js --env-file flag

const ODOO_BASE_URL = process.env.ODOO_BASE_URL;
const ODOO_API_KEY = process.env.ODOO_API_KEY;
const ODOO_DB_NAME = process.env.ODOO_DB_NAME;
const ODOO_USERNAME = process.env.ODOO_USERNAME || "PLEASE_ADD_YOUR_LOGIN_EMAIL_HERE";

async function createOdooUser() {
  if (!ODOO_BASE_URL || !ODOO_API_KEY || !ODOO_DB_NAME) {
    console.error("Missing Odoo credentials in .env file");
    return;
  }

  if (ODOO_USERNAME === "PLEASE_ADD_YOUR_LOGIN_EMAIL_HERE") {
    console.error("Missing ODOO_USERNAME! Odoo requires the login email (username) associated with the API key.");
    return;
  }

  console.log(`Authenticating to Odoo at: ${ODOO_BASE_URL}...`);

  try {
    // STEP 1: Authenticate to get the User ID (uid)
    const authPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "authenticate",
        args: [ODOO_DB_NAME, ODOO_USERNAME, ODOO_API_KEY, {}],
      },
      id: 1,
    };

    const authRes = await fetch(`${ODOO_BASE_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authPayload),
    });

    const authData = await authRes.json();
    if (authData.error) throw new Error(JSON.stringify(authData.error));
    
    const uid = authData.result;
    if (!uid) {
      console.error("Authentication failed. Invalid username, API key, or database name.");
      return;
    }
    
    console.log(`Authentication successful! UID: ${uid}`);
    console.log(`Creating test user...`);


    const createPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          ODOO_DB_NAME,
          uid,
          ODOO_API_KEY,
          "res.partner",   // The Odoo model
          "create",        // The operation
          [
            {
              name: "Test User 1",
              email: "test3.full@example.com",
              phone: "+919876543212",
              is_company: false,
              active: true,
            }
          ]
        ]
      },
      id: 2,
    };

    const createRes = await fetch(`${ODOO_BASE_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });

    const createData = await createRes.json();
    
    if (createData.error) {
       console.error("Odoo returned an error during creation:", JSON.stringify(createData.error, null, 2));
    } else {
       console.log("Success! Created user in Odoo. New Record ID:", createData.result);
    }
    
  } catch (error) {
    console.error("Failed to interact with Odoo:", error);
  }
}

createOdooUser();
