
const bcrypt = require('bcryptjs');

// Verificar contraseñas comunes
const passwords = ['admin123', 'Admin123\!', 'password123', '123456', 'juank123'];
const hash = '$2b$12$F/gS1lRKJlijZF19RBAGP.uKIjlk4OcUmYT6dCJUMUp1igU3iJVeq';

async function test() {
  for (const pwd of passwords) {
    const isValid = await bcrypt.compare(pwd, hash);
    console.log(`${pwd}: ${isValid}`);
  }
}

test();

