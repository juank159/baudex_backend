import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { SupplierResponseDto } from './dto/supplier-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo proveedor' })
  @ApiResponse({
    status: 201,
    description: 'Proveedor creado exitosamente',
    type: SupplierResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Código de proveedor ya existe' })
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @TenantId() organizationId: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.create(createSupplierDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de proveedores' })
  @ApiResponse({
    status: 200,
    description: 'Lista de proveedores obtenida exitosamente',
    type: PaginatedResponseDto<SupplierResponseDto>,
  })
  async findAll(
    @Query() query: SupplierQueryDto,
    @TenantId() organizationId: string,
  ): Promise<PaginatedResponseDto<SupplierResponseDto>> {
    return this.suppliersService.findAll(query, organizationId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener proveedores activos' })
  @ApiResponse({
    status: 200,
    description: 'Proveedores activos obtenidos',
    type: [SupplierResponseDto],
  })
  async getActiveSuppliers(
    @TenantId() organizationId: string,
  ): Promise<SupplierResponseDto[]> {
    return this.suppliersService.getActiveSuppliers(organizationId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de proveedores' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  async getStats(@TenantId() organizationId: string) {
    return this.suppliersService.getSupplierStats(organizationId);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Buscar proveedores por nombre y número de documento',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultados de búsqueda obtenidos',
    type: [SupplierResponseDto],
  })
  async searchSuppliers(
    @Query() query: SupplierQueryDto,
    @TenantId() organizationId: string,
  ): Promise<SupplierResponseDto[]> {
    if (!query.search) {
      return [];
    }

    const result = await this.suppliersService.findAll(query, organizationId);
    return result.data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener proveedor por ID' })
  @ApiResponse({
    status: 200,
    description: 'Proveedor encontrado',
    type: SupplierResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar proveedor' })
  @ApiResponse({
    status: 200,
    description: 'Proveedor actualizado exitosamente',
    type: SupplierResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @ApiResponse({ status: 409, description: 'Código de proveedor ya existe' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @TenantId() organizationId: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.update(id, updateSupplierDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar proveedor' })
  @ApiResponse({ status: 200, description: 'Proveedor eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() organizationId: string,
  ): Promise<{ message: string }> {
    await this.suppliersService.remove(id, organizationId);
    return { message: 'Supplier deleted successfully' };
  }

  @Post('check-document-uniqueness')
  @ApiOperation({
    summary: 'Verificar si la combinación de documento es única',
  })
  @ApiResponse({
    status: 200,
    description: 'Verificación completada',
    schema: { properties: { isUnique: { type: 'boolean' } } },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async checkDocumentUniqueness(
    @Body()
    body: { documentType: string; documentNumber: string; excludeId?: string },
    @TenantId() organizationId: string,
  ): Promise<{ isUnique: boolean }> {
    const { documentType, documentNumber, excludeId } = body;

    // Buscar si existe un proveedor con la misma combinación de documento
    const existing = await this.suppliersService.findByDocumentTypeAndNumber(
      documentType,
      documentNumber,
      organizationId,
      excludeId,
    );

    return { isUnique: !existing };
  }
}
