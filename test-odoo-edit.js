// Env variables are loaded natively via Node.js --env-file flag

const ODOO_BASE_URL = process.env.ODOO_BASE_URL;
const ODOO_API_KEY = process.env.ODOO_API_KEY;
const ODOO_DB_NAME = process.env.ODOO_DB_NAME;
const ODOO_USERNAME = process.env.ODOO_USERNAME || "PLEASE_ADD_YOUR_LOGIN_EMAIL_HERE";

async function editOdooUser() {
  if (!ODOO_BASE_URL || !ODOO_API_KEY || !ODOO_DB_NAME) {
    console.error("Missing Odoo credentials in .env file");
    return;
  }

  if (ODOO_USERNAME === "PLEASE_ADD_YOUR_LOGIN_EMAIL_HERE") {
    console.error("Missing ODOO_USERNAME! Odoo requires the login email (username) associated with the API key.");
    return;
  }

  // NOTE: Replace this ID with the ID of the user you want to edit!
  const RECORD_ID_TO_EDIT = 105; 

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
    console.log(`Editing user with ID ${RECORD_ID_TO_EDIT}...`);

    // STEP 2: Edit the Customer Record using execute_kw and "write" method
    const editPayload = {
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
          "write",         // The operation for updating
          [
            [RECORD_ID_TO_EDIT], // Array of record IDs to update
            {
              name: "Test User 1 ",
              phone: "+911234567890",
            }
          ]
        ]
      },
      id: 2,
    };

    const editRes = await fetch(`${ODOO_BASE_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editPayload),
    });

    const editData = await editRes.json();
    
    if (editData.error) {
       console.error("Odoo returned an error during edit:", JSON.stringify(editData.error, null, 2));
    } else {
       console.log("Success! Edited user in Odoo. Response:", editData.result);
    }
    
  } catch (error) {
    console.error("Failed to interact with Odoo:", error);
  }
}

editOdooUser();
