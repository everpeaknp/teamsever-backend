const jwt = require('jsonwebtoken');
const axios = require('axios');
const JWT_SECRET = 'jwt@345';
const USER_ID = '69bbf815a96fe78f716752a6';

const token = jwt.sign({ id: USER_ID }, JWT_SECRET, { expiresIn: '1h' });

async function check() {
  try {
    const res = await axios.get('http://localhost:5000/api/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("API Response count:", res.data.count);
    console.log("API Response data:", JSON.stringify(res.data.data, null, 2));
  } catch (err) {
    console.error("API Error:", err.response?.data || err.message);
  }
}
check();
