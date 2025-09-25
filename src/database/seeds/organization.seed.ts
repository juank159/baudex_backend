import { DataSource } from 'typeorm';
import {
  Organization,
  SubscriptionPlan,
} from '../../organizations/entities/organization.entity';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

export class OrganizationSeeder {
  constructor(private dataSource: DataSource) {}

  async run(): Promise<void> {
    console.log('🏢 Seeding organizations...');

    const organizationRepository = this.dataSource.getRepository(Organization);
    const userRepository = this.dataSource.getRepository(User);

    // Verificar si ya existe la organización por defecto
    const existingOrg = await organizationRepository.findOne({
      where: { slug: 'default' },
    });

    if (existingOrg) {
      console.log('✅ Default organization already exists, skipping...');
      return;
    }

    // Crear organización por defecto
    const defaultOrg = organizationRepository.create({
      name: 'Default Organization',
      slug: 'default',
      subscriptionPlan: SubscriptionPlan.ENTERPRISE,
      isActive: true,
      currency: 'USD',
      locale: 'en',
      timezone: 'America/New_York',
      settings: {
        companyAddress: '123 Main St, New York, NY 10001',
        taxId: 'TAX123456789',
        phone: '+1-555-123-4567',
        website: 'https://example.com',
        allowSelfRegistration: true,
        theme: 'default',
      },
    });

    const savedOrg = await organizationRepository.save(defaultOrg);
    console.log(`✅ Created default organization: ${savedOrg.name}`);

    // Crear usuario super admin por defecto si no existe
    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@default.com' },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const adminUser = userRepository.create({
        email: 'admin@default.com',
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        organizationId: savedOrg.id,
      });

      await userRepository.save(adminUser);
      console.log(
        '✅ Created default admin user: admin@default.com / admin123',
      );
    }

    // Crear organizaciones de demostración
    const demoOrganizations = [
      {
        name: 'Acme Corporation',
        slug: 'acme-corp',
        subscriptionPlan: SubscriptionPlan.PREMIUM,
        adminEmail: 'admin@acme.com',
        adminPassword: 'acme123',
        adminFirstName: 'John',
        adminLastName: 'Smith',
        settings: {
          companyAddress: '456 Business Ave, Los Angeles, CA 90210',
          taxId: 'ACME789123456',
          phone: '+1-555-987-6543',
          website: 'https://acme-corp.com',
        },
      },
      {
        name: 'TechStart Solutions',
        slug: 'techstart',
        subscriptionPlan: SubscriptionPlan.BASIC,
        adminEmail: 'admin@techstart.com',
        adminPassword: 'tech123',
        adminFirstName: 'Sarah',
        adminLastName: 'Johnson',
        settings: {
          companyAddress: '789 Innovation Blvd, Austin, TX 78701',
          taxId: 'TECH456789123',
          phone: '+1-555-456-7890',
          website: 'https://techstart.com',
        },
      },
      {
        name: 'Global Enterprises',
        slug: 'global-ent',
        subscriptionPlan: SubscriptionPlan.ENTERPRISE,
        adminEmail: 'admin@globalent.com',
        adminPassword: 'global123',
        adminFirstName: 'Michael',
        adminLastName: 'Davis',
        settings: {
          companyAddress: '321 Enterprise Way, Chicago, IL 60601',
          taxId: 'GLOBAL123456789',
          phone: '+1-555-321-9876',
          website: 'https://globalenterprises.com',
        },
      },
    ];

    for (const orgData of demoOrganizations) {
      // Verificar si ya existe
      const existingDemoOrg = await organizationRepository.findOne({
        where: { slug: orgData.slug },
      });

      if (existingDemoOrg) {
        console.log(
          `⏭️  Organization ${orgData.slug} already exists, skipping...`,
        );
        continue;
      }

      // Crear organización
      const org = organizationRepository.create({
        name: orgData.name,
        slug: orgData.slug,
        subscriptionPlan: orgData.subscriptionPlan,
        isActive: true,
        currency: 'USD',
        locale: 'en',
        timezone: 'America/New_York',
        settings: orgData.settings,
      });

      const savedDemoOrg = await organizationRepository.save(org);
      console.log(`✅ Created organization: ${savedDemoOrg.name}`);

      // Crear usuario admin para la organización
      const existingDemoAdmin = await userRepository.findOne({
        where: { email: orgData.adminEmail },
      });

      if (!existingDemoAdmin) {
        const hashedPassword = await bcrypt.hash(orgData.adminPassword, 12);
        const adminUser = userRepository.create({
          email: orgData.adminEmail,
          password: hashedPassword,
          firstName: orgData.adminFirstName,
          lastName: orgData.adminLastName,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          organizationId: savedDemoOrg.id,
        });

        await userRepository.save(adminUser);
        console.log(
          `✅ Created admin user: ${orgData.adminEmail} / ${orgData.adminPassword}`,
        );
      }
    }

    console.log('🎉 Organization seeding completed!');
  }
}
