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
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(private dataSource: DataSource) {}

  async validate(value: any, args: ValidationArguments) {
    const [entityClass, field = 'id'] = args.constraints;

    if (!value) return true;

    const repository = this.dataSource.getRepository(entityClass);
    const entity = await repository.findOne({
      where: { [field]: value },
    });

    return !!entity;
  }

  defaultMessage(args: ValidationArguments) {
    const [entityClass, field = 'id'] = args.constraints;
    return `${entityClass.name} con ${field} no existe`;
  }
}

export function Exists(
  entityClass: any,
  field = 'id',
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [entityClass, field],
      validator: ExistsConstraint,
    });
  };
}
