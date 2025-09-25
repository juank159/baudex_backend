import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ValidationGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // Validar que IDs sean UUIDs válidos si están en los parámetros
    const params = request.params;
    for (const [key, value] of Object.entries(params)) {
      if (key.includes('Id') || key === 'id') {
        if (!this.isValidUUID(value as string)) {
          throw new BadRequestException(`${key} debe ser un UUID válido`);
        }
      }
    }

    return true;
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
