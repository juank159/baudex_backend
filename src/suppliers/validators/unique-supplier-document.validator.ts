import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';

@ValidatorConstraint({ async: true })
@Injectable()
export class UniqueSupplierDocumentConstraint
  implements ValidatorConstraintInterface
{
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async validate(
    documentNumber: string,
    args: ValidationArguments,
  ): Promise<boolean> {
    if (!documentNumber) {
      return true; // Si no hay número de documento, no validamos unicidad
    }

    const dto = args.object as any;
    const { documentType, organizationId, id } = dto;

    if (!documentType || !organizationId) {
      return true; // Si no hay tipo de documento u organización, no validamos
    }

    // Buscar suppliers con el mismo documento en la misma organización
    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.documentType = :documentType', { documentType })
      .andWhere('supplier.documentNumber = :documentNumber', { documentNumber })
      .andWhere('supplier.organizationId = :organizationId', { organizationId })
      .andWhere('supplier.deletedAt IS NULL');

    // Excluir el supplier actual en caso de actualización
    if (id) {
      queryBuilder.andWhere('supplier.id != :id', { id });
    }

    const existingSupplier = await queryBuilder.getOne();
    return !existingSupplier;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as any;
    return `Ya existe un proveedor con ${dto.documentType}: ${args.value} en esta organización`;
  }
}

// Decorador personalizado
export function IsUniqueSupplierDocument(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: UniqueSupplierDocumentConstraint,
    });
  };
}
