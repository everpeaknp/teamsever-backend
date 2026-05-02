const axios = require('axios');

const login = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@everacy.com',
      password: 'SuperAdmin123!'
    });
    console.log('✅ Login successful:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Login failed:', error.response.status, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
};

login();
