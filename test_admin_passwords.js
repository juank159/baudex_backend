
const bcrypt = require('bcryptjs');

async function testPasswords() {
  const hash = '$2b$12$F/gS1lRKJlijZF19RBAGP.uKIjlk4OcUmYT6dCJUMUp1igU3iJVeq';
  const passwords = ['admin123', 'Admin123\!', 'password123', '123456', 'admin', 'default123'];
  
  for (const password of passwords) {
    const isValid = await bcrypt.compare(password, hash);
    console.log(`${password}: ${isValid}`);
  }
}

testPasswords();

