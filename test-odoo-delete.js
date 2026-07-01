// Env variables are loaded natively via Node.js --env-file flag

const ODOO_BASE_URL = process.env.ODOO_BASE_URL;
const ODOO_API_KEY = process.env.ODOO_API_KEY;
const ODOO_DB_NAME = process.env.ODOO_DB_NAME;
const ODOO_USERNAME = process.env.ODOO_USERNAME || "PLEASE_ADD_YOUR_LOGIN_EMAIL_HERE";

async function deleteOdooUser() {
  if (!ODOO_BASE_URL || !ODOO_API_KEY || !ODOO_DB_NAME) {
    console.error("Missing Odoo credentials in .env file");
    return;
  }

  if (ODOO_USERNAME === "PLEASE_ADD_YOUR_LOGIN_EMAIL_HERE") {
    console.error("Missing ODOO_USERNAME! Odoo requires the login email (username) associated with the API key.");
    return;
  }

  // NOTE: Replace this ID with the ID of the user you want to delete!
  const RECORD_ID_TO_DELETE = 30; 

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
    console.log(`Deleting user with ID ${RECORD_ID_TO_DELETE}...`);

    // STEP 2: Delete the Customer Record using execute_kw and "unlink" method
    const deletePayload = {
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
          "unlink",        // The operation for deleting
          [
            [RECORD_ID_TO_DELETE] // Array of record IDs to delete
          ]
        ]
      },
      id: 2,
    };

    const deleteRes = await fetch(`${ODOO_BASE_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletePayload),
    });

    const deleteData = await deleteRes.json();
    
    if (deleteData.error) {
       console.error("Odoo returned an error during deletion:", JSON.stringify(deleteData.error, null, 2));
    } else {
       console.log("Success! Deleted user in Odoo. Response:", deleteData.result);
    }
    
  } catch (error) {
    console.error("Failed to interact with Odoo:", error);
  }
}

deleteOdooUser();
