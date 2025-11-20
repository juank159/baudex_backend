
const bcrypt = require('bcryptjs');

async function resetPasswords() {
  // Generar hashes para contraseñas conocidas
  const adminHash = await bcrypt.hash('admin123', 12);
  const juankHash = await bcrypt.hash('juank123', 12);
  
  console.log('admin123 hash:', adminHash);
  console.log('juank123 hash:', juankHash);
}

resetPasswords();

