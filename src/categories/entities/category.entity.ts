// // src/modules/categories/entities/category.entity.ts
// import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
// import { BaseEntity } from '../../common/entities/base.entity';
// import { Product } from '../../products/entities/product.entity';

// export enum CategoryStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
// }

// @Entity('categories')
// export class Category extends BaseEntity {
//   @Column({ type: 'varchar', length: 100 })
//   name: string;

//   @Column({ type: 'text', nullable: true })
//   description?: string;

//   @Column({ type: 'varchar', length: 50, unique: true })
//   slug: string;

//   @Column({ type: 'text', nullable: true })
//   image?: string;

//   @Column({
//     type: 'enum',
//     enum: CategoryStatus,
//     default: CategoryStatus.ACTIVE,
//   })
//   status: CategoryStatus;

//   @Column({ type: 'int', default: 0 })
//   sortOrder: number;

//   // Jerarquía de categorías (categoría padre)
//   @Column({ type: 'uuid', nullable: true })
//   parentId?: string;

//   @ManyToOne(() => Category, (category) => category.children, {
//     nullable: true,
//     onDelete: 'SET NULL',
//   })
//   @JoinColumn({ name: 'parent_id' })
//   parent?: Category;

//   @OneToMany(() => Category, (category) => category.parent)
//   children: Category[];

//   // Relaciones con productos
//   @OneToMany(() => Product, (product) => product.category)
//   products: Product[];

//   // ✨ NUEVA PROPIEDAD: Conteo virtual de productos
//   productsCount?: number;

//   // Métodos útiles
//   get isActive(): boolean {
//     return this.status === CategoryStatus.ACTIVE && !this.deletedAt;
//   }

//   get isParent(): boolean {
//     return this.children && this.children.length > 0;
//   }

//   get level(): number {
//     let level = 0;
//     let current = this.parent;
//     while (current) {
//       level++;
//       current = current.parent;
//     }
//     return level;
//   }

//   // Método para obtener la ruta completa de la categoría
//   getFullPath(): string {
//     const path: string[] = [];
//     let current: Category = this;

//     while (current) {
//       path.unshift(current.name);
//       current = current.parent;
//     }

//     return path.join(' > ');
//   }
// }

// src/modules/categories/entities/category.entity.ts
import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';

export enum CategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// Índice único parcial que excluye registros eliminados
@Index('UQ_categories_slug_not_deleted', ['slug'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Entity('categories')
export class Category extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Remover el unique: true del decorador @Column
  @Column({ type: 'varchar', length: 50 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({
    type: 'enum',
    enum: CategoryStatus,
    default: CategoryStatus.ACTIVE,
  })
  status: CategoryStatus;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  // Jerarquía de categorías (categoría padre)
  @Column({ type: 'uuid', nullable: true, name: 'parent_id' }) // ✅ Especificar nombre explícito
  parentId?: string;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' }) // ✅ Usar el mismo nombre
  parent?: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  // Relaciones con productos
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  // ✨ NUEVA PROPIEDAD: Conteo virtual de productos
  productsCount?: number;

  // Métodos útiles
  get isActive(): boolean {
    return this.status === CategoryStatus.ACTIVE && !this.deletedAt;
  }

  get isParent(): boolean {
    return this.children && this.children.length > 0;
  }

  get level(): number {
    let level = 0;
    let current = this.parent;
    while (current) {
      level++;
      current = current.parent;
    }
    return level;
  }

  // Método para obtener la ruta completa de la categoría
  getFullPath(): string {
    const path: string[] = [];
    let current: Category = this;

    while (current) {
      path.unshift(current.name);
      current = current.parent;
    }

    return path.join(' > ');
  }
}
