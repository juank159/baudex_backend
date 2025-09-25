import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category } from '../../categories/entities/category.entity';
import { Customer } from '../../customers/entities/customer.entity';
import {
  Product,
  ProductStatus,
  ProductType,
} from '../../products/entities/product.entity';
import {
  ProductPrice,
  PriceType,
} from '../../products/entities/product-price.entity';
import { ExpenseCategory } from '../../expenses/entities/expense-category.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
} from '../../invoices/entities/invoice.entity';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ExpenseCategory)
    private readonly expenseCategoryRepository: Repository<ExpenseCategory>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(ProductPrice)
    private readonly productPriceRepository: Repository<ProductPrice>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Crear datos de muestra para una nueva organización
   */
  async createSampleDataForOrganization(
    organizationId: string,
    user: User,
  ): Promise<void> {
    try {
      console.log(
        `🌱 Creando datos de muestra para organización: ${organizationId}`,
      );

      // 0. Crear almacén principal (CRÍTICO: debe ser lo primero)
      const mainWarehouse = await this.createMainWarehouse(organizationId);
      console.log(`✅ Almacén principal creado: ${mainWarehouse.name}`);

      // 1. Crear categorías de productos
      const categories = await this.createSampleCategories(organizationId);
      console.log(`✅ Creadas ${categories.length} categorías de productos`);

      // 2. Crear clientes
      const customers = await this.createSampleCustomers(organizationId);
      console.log(`✅ Creados ${customers.length} clientes`);

      // 3. Crear productos
      const products = await this.createSampleProducts(
        organizationId,
        categories,
      );
      console.log(`✅ Creados ${products.length} productos`);

      // 4. Crear categorías de gastos
      const expenseCategories =
        await this.createSampleExpenseCategories(organizationId);
      console.log(
        `✅ Creadas ${expenseCategories.length} categorías de gastos`,
      );

      // 5. Crear gastos
      const expenses = await this.createSampleExpenses(
        organizationId,
        expenseCategories,
      );
      console.log(`✅ Creados ${expenses.length} gastos`);

      // 6. Crear facturas con ítems
      const invoices = await this.createSampleInvoices(
        organizationId,
        customers,
        products,
      );
      console.log(`✅ Creadas ${invoices.length} facturas`);

      console.log(
        `🎉 Datos de muestra creados exitosamente para organización: ${organizationId}`,
      );
    } catch (error) {
      console.error(`❌ Error creando datos de muestra:`, error);
      throw error;
    }
  }

  /**
   * Crear almacén principal para la organización
   */
  private async createMainWarehouse(
    organizationId: string,
  ): Promise<Warehouse> {
    // Generar código único para el almacén
    const timestamp = Date.now().toString().slice(-6);
    const warehouseCode = `ALM-${timestamp}`;

    // Crear el almacén principal
    const warehouse = this.warehouseRepository.create({
      name: 'Almacén Principal',
      code: warehouseCode,
      description: 'Almacén principal de la empresa - creado automáticamente',
      isActive: true,
      isMainWarehouse: true,
      organizationId,
    });

    const savedWarehouse = await this.warehouseRepository.save(warehouse);

    // Actualizar la organización para referenciar este almacén como principal
    await this.organizationRepository.update(organizationId, {
      mainWarehouseId: savedWarehouse.id,
    });

    return savedWarehouse;
  }

  /**
   * Crear categorías de productos de muestra
   */
  private async createSampleCategories(
    organizationId: string,
  ): Promise<Category[]> {
    const categoryData = [
      {
        name: 'Electrónicos',
        description: 'Dispositivos electrónicos y tecnología',
        color: '#3B82F6',
        isActive: true,
      },
      {
        name: 'Ropa y Accesorios',
        description: 'Prendas de vestir y accesorios de moda',
        color: '#EF4444',
        isActive: true,
      },
      {
        name: 'Hogar y Jardín',
        description: 'Artículos para el hogar y jardinería',
        color: '#10B981',
        isActive: true,
      },
      {
        name: 'Servicios',
        description: 'Servicios profesionales y consultoría',
        color: '#8B5CF6',
        isActive: true,
      },
    ];

    const categories: Category[] = [];

    for (const data of categoryData) {
      const category = this.categoryRepository.create({
        ...data,
        organizationId,
      });
      const savedCategory = await this.categoryRepository.save(category);
      categories.push(savedCategory);
    }

    return categories;
  }

  /**
   * Crear clientes de muestra
   */
  private async createSampleCustomers(
    organizationId: string,
  ): Promise<Customer[]> {
    const customerData = [
      {
        firstName: 'Ana',
        lastName: 'García',
        email: 'ana.garcia@email.com',
        phone: '+1234567890',
        company: 'García Consulting',
        address: 'Calle Principal 123',
        city: 'Ciudad Principal',
        postalCode: '12345',
        country: 'España',
        isActive: true,
      },
      {
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        email: 'carlos.rodriguez@empresa.com',
        phone: '+1234567891',
        company: 'Rodríguez & Asociados',
        address: 'Avenida Central 456',
        city: 'Ciudad Central',
        postalCode: '67890',
        country: 'España',
        isActive: true,
      },
      {
        firstName: 'Elena',
        lastName: 'Martínez',
        email: 'elena.martinez@negocio.com',
        phone: '+1234567892',
        company: 'Martínez Solutions',
        address: 'Plaza Mayor 789',
        city: 'Ciudad Mayor',
        postalCode: '54321',
        country: 'España',
        isActive: true,
      },
    ];

    const customers: Customer[] = [];

    for (const data of customerData) {
      const customer = this.customerRepository.create({
        ...data,
        organizationId,
      });
      const savedCustomer = await this.customerRepository.save(customer);
      customers.push(savedCustomer);
    }

    return customers;
  }

  /**
   * Crear productos de muestra
   */
  private async createSampleProducts(
    organizationId: string,
    categories: Category[],
  ): Promise<Product[]> {
    const electronicsCategory = categories.find(
      (c) => c.name === 'Electrónicos',
    );
    const clothingCategory = categories.find(
      (c) => c.name === 'Ropa y Accesorios',
    );
    const homeCategory = categories.find((c) => c.name === 'Hogar y Jardín');
    const servicesCategory = categories.find((c) => c.name === 'Servicios');

    const productData = [
      {
        name: 'Laptop Profesional',
        description: 'Laptop de alta gama para profesionales',
        sku: 'LAP-001',
        type: ProductType.PRODUCT,
        status: ProductStatus.ACTIVE,
        stock: 15,
        minStock: 5,
        categoryId: electronicsCategory?.id,
        price: 1299.99,
        cost: 850.0,
      },
      {
        name: 'Smartphone Premium',
        description: 'Teléfono inteligente con las últimas características',
        sku: 'PHONE-001',
        type: ProductType.PRODUCT,
        status: ProductStatus.ACTIVE,
        stock: 25,
        minStock: 10,
        categoryId: electronicsCategory?.id,
        price: 899.99,
        cost: 600.0,
      },
      {
        name: 'Camiseta Premium',
        description: 'Camiseta de algodón 100% orgánico',
        sku: 'SHIRT-001',
        type: ProductType.PRODUCT,
        status: ProductStatus.ACTIVE,
        stock: 100,
        minStock: 20,
        categoryId: clothingCategory?.id,
        price: 29.99,
        cost: 15.0,
      },
      {
        name: 'Jeans Clásicos',
        description: 'Jeans de mezclilla de alta calidad',
        sku: 'JEANS-001',
        type: ProductType.PRODUCT,
        status: ProductStatus.ACTIVE,
        stock: 50,
        minStock: 15,
        categoryId: clothingCategory?.id,
        price: 79.99,
        cost: 40.0,
      },
      {
        name: 'Lámpara de Mesa',
        description: 'Lámpara LED moderna para escritorio',
        sku: 'LAMP-001',
        type: ProductType.PRODUCT,
        status: ProductStatus.ACTIVE,
        stock: 30,
        minStock: 10,
        categoryId: homeCategory?.id,
        price: 49.99,
        cost: 25.0,
      },
      {
        name: 'Consultoría IT',
        description: 'Servicio de consultoría en tecnología por hora',
        sku: 'CONSULT-001',
        type: ProductType.SERVICE,
        status: ProductStatus.ACTIVE,
        stock: 0,
        minStock: 0,
        categoryId: servicesCategory?.id,
        price: 85.0,
        cost: 0.0,
      },
    ];

    const products: Product[] = [];

    for (const data of productData) {
      const { price, cost, ...productData } = data;

      // Crear producto sin precio
      const product = this.productRepository.create({
        ...productData,
        organizationId,
      });
      const savedProduct = await this.productRepository.save(product);

      // Crear precio para el producto
      const productPrice = this.productPriceRepository.create({
        productId: savedProduct.id,
        type: PriceType.PRICE1,
        amount: price,
      });
      await this.productPriceRepository.save(productPrice);

      products.push(savedProduct);
    }

    return products;
  }

  /**
   * Crear categorías de gastos de muestra
   */
  private async createSampleExpenseCategories(
    organizationId: string,
  ): Promise<ExpenseCategory[]> {
    const expenseCategoryData = [
      {
        name: 'Oficina',
        description: 'Gastos de oficina y suministros',
        color: '#6B7280',
        isActive: true,
      },
      {
        name: 'Marketing',
        description: 'Gastos de publicidad y marketing',
        color: '#F59E0B',
        isActive: true,
      },
      {
        name: 'Transporte',
        description: 'Gastos de transporte y combustible',
        color: '#3B82F6',
        isActive: true,
      },
      {
        name: 'Servicios',
        description: 'Servicios profesionales y suscripciones',
        color: '#8B5CF6',
        isActive: true,
      },
    ];

    const expenseCategories: ExpenseCategory[] = [];

    for (const data of expenseCategoryData) {
      const expenseCategory = this.expenseCategoryRepository.create({
        ...data,
        organizationId,
      });
      const savedExpenseCategory =
        await this.expenseCategoryRepository.save(expenseCategory);
      expenseCategories.push(savedExpenseCategory);
    }

    return expenseCategories;
  }

  /**
   * Crear gastos de muestra
   */
  private async createSampleExpenses(
    organizationId: string,
    expenseCategories: ExpenseCategory[],
  ): Promise<Expense[]> {
    const officeCategory = expenseCategories.find((c) => c.name === 'Oficina');
    const marketingCategory = expenseCategories.find(
      (c) => c.name === 'Marketing',
    );
    const transportCategory = expenseCategories.find(
      (c) => c.name === 'Transporte',
    );
    const servicesCategory = expenseCategories.find(
      (c) => c.name === 'Servicios',
    );

    const expenseData = [
      {
        title: 'Suministros de Oficina',
        description: 'Papel, bolígrafos y material de oficina',
        amount: 125.5,
        categoryId: officeCategory?.id,
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 días atrás
      },
      {
        title: 'Campaña de Google Ads',
        description: 'Publicidad online para promoción',
        amount: 350.0,
        categoryId: marketingCategory?.id,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 días atrás
      },
      {
        title: 'Combustible Vehículo Empresa',
        description: 'Tanque lleno para vehículo de reparto',
        amount: 75.25,
        categoryId: transportCategory?.id,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 días atrás
      },
      {
        title: 'Suscripción Software CRM',
        description: 'Mensualidad del sistema de gestión',
        amount: 99.99,
        categoryId: servicesCategory?.id,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 día atrás
      },
    ];

    const expenses: Expense[] = [];

    for (const data of expenseData) {
      const expense = this.expenseRepository.create({
        ...data,
        organizationId,
      });
      const savedExpense = await this.expenseRepository.save(expense);
      expenses.push(savedExpense);
    }

    return expenses;
  }

  /**
   * Crear facturas de muestra con ítems
   */
  private async createSampleInvoices(
    organizationId: string,
    customers: Customer[],
    products: Product[],
  ): Promise<Invoice[]> {
    const invoices: Invoice[] = [];

    // Factura 1 - Pagada
    const invoice1 = this.invoiceRepository.create({
      number: 'INV-001',
      customerId: customers[0]?.id,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 días atrás
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 días atrás
      status: InvoiceStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      subtotal: 1329.98,
      taxAmount: 265.99,
      total: 1595.97,
      notes: 'Gracias por su compra',
      organizationId,
    });
    const savedInvoice1 = await this.invoiceRepository.save(invoice1);

    // Ítems para factura 1
    const laptop = products.find((p) => p.name === 'Laptop Profesional');
    const shirt = products.find((p) => p.name === 'Camiseta Premium');

    if (laptop) {
      const item1 = this.invoiceItemRepository.create({
        invoiceId: savedInvoice1.id,
        productId: laptop.id,
        description: laptop.name,
        quantity: 1,
        unitPrice: 1299.99,
        subtotal: 1299.99,
      });
      await this.invoiceItemRepository.save(item1);
    }

    if (shirt) {
      const item2 = this.invoiceItemRepository.create({
        invoiceId: savedInvoice1.id,
        productId: shirt.id,
        description: shirt.name,
        quantity: 1,
        unitPrice: 29.99,
        subtotal: 29.99,
      });
      await this.invoiceItemRepository.save(item2);
    }

    invoices.push(savedInvoice1);

    // Factura 2 - Pendiente
    const invoice2 = this.invoiceRepository.create({
      number: 'INV-002',
      customerId: customers[1]?.id,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 días atrás
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días adelante
      status: InvoiceStatus.PENDING,
      paymentMethod: PaymentMethod.CASH,
      subtotal: 899.99,
      taxAmount: 179.99,
      total: 1079.98,
      notes: 'Pago pendiente',
      organizationId,
    });
    const savedInvoice2 = await this.invoiceRepository.save(invoice2);

    // Ítems para factura 2
    const smartphone = products.find((p) => p.name === 'Smartphone Premium');

    if (smartphone) {
      const item3 = this.invoiceItemRepository.create({
        invoiceId: savedInvoice2.id,
        productId: smartphone.id,
        description: smartphone.name,
        quantity: 1,
        unitPrice: 899.99,
        subtotal: 899.99,
      });
      await this.invoiceItemRepository.save(item3);
    }

    invoices.push(savedInvoice2);

    // Factura 3 - Servicios
    const invoice3 = this.invoiceRepository.create({
      number: 'INV-003',
      customerId: customers[2]?.id,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días adelante
      status: InvoiceStatus.DRAFT,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      subtotal: 340.0,
      taxAmount: 68.0,
      total: 408.0,
      notes: 'Consultoría mensual',
      organizationId,
    });
    const savedInvoice3 = await this.invoiceRepository.save(invoice3);

    // Ítems para factura 3
    const consulting = products.find((p) => p.name === 'Consultoría IT');

    if (consulting) {
      const item4 = this.invoiceItemRepository.create({
        invoiceId: savedInvoice3.id,
        productId: consulting.id,
        description: consulting.name,
        quantity: 4, // 4 horas
        unitPrice: 85.0,
        subtotal: 340.0,
      });
      await this.invoiceItemRepository.save(item4);
    }

    invoices.push(savedInvoice3);

    return invoices;
  }
}
