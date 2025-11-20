
const bcrypt = require('bcryptjs');

async function testPassword() {
  const hash = '$2b$12$yJ48PhkhXsVEksWJDLocROCJ1ha91DROeVOH/mE8FNekIFm5JkRpu';
  const password = 'juank123';
  
  const isValid = await bcrypt.compare(password, hash);
  console.log(`Password ${password}: ${isValid}`);
}

testPassword();

