import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private dataSource: DataSource) {}

  async validate(value: any, args: ValidationArguments) {
    const [entityClass, field] = args.constraints;
    const entity = args.object as any;

    if (!value) return true;

    const repository = this.dataSource.getRepository(entityClass);
    const queryBuilder = repository.createQueryBuilder('entity');

    queryBuilder.where(`entity.${field} = :value`, { value });

    // Si estamos actualizando, excluir el registro actual
    if (entity.id) {
      queryBuilder.andWhere('entity.id != :id', { id: entity.id });
    }

    const count = await queryBuilder.getCount();
    return count === 0;
  }

  defaultMessage(args: ValidationArguments) {
    const [, field] = args.constraints;
    return `${field} ya existe`;
  }
}

export function IsUnique(
  entityClass: any,
  field: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [entityClass, field],
      validator: IsUniqueConstraint,
    });
  };
}
