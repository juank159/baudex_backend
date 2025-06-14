import { User, UserRole, UserStatus } from 'src/users/entities/user.entity';
import { DataSource } from 'typeorm';

export class UserSeeder {
  static async run(dataSource: DataSource): Promise<void> {
    const userRepository = dataSource.getRepository(User);

    // Verificar si ya existen usuarios
    const existingUsers = await userRepository.count();
    if (existingUsers > 0) {
      console.log('👥 Usuarios ya existen, saltando seed');
      return;
    }

    const users = [
      {
        firstName: 'Admin',
        lastName: 'Sistema',
        email: 'admin@facturacion.com',
        password: 'Admin123!',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
      {
        firstName: 'Manager',
        lastName: 'Ventas',
        email: 'manager@facturacion.com',
        password: 'Manager123!',
        role: UserRole.MANAGER,
        status: UserStatus.ACTIVE,
      },
      {
        firstName: 'Usuario',
        lastName: 'Demo',
        email: 'user@facturacion.com',
        password: 'User123!',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    ];

    const createdUsers = userRepository.create(users);
    await userRepository.save(createdUsers);

    console.log('👥 Usuarios seed completado');
  }
}
