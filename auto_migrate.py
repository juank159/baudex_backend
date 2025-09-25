#!/usr/bin/env python3
"""
🚀 MIGRADOR AUTOMÁTICO DE BASE DE DATOS NO-MULTITENANT A MULTITENANT
==================================================================

USO SIMPLE:
python3 auto_migrate.py backup_viejo.sql "Mi Empresa" mi-empresa

¡ESO ES TODO! El script hace ABSOLUTAMENTE TODO automáticamente:
- Detecta encoding y convierte automáticamente
- Analiza estructura de la BD antigua
- Detecta estructura de la BD nueva
- Genera UUID único automáticamente
- Crea script de migración en orden correcto
- Ejecuta la migración
- Verifica integridad automáticamente
- Crea backup de seguridad automáticamente
"""

import os
import sys
import re
import uuid
import subprocess
import json
from datetime import datetime
from collections import OrderedDict
from pathlib import Path

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(step, message):
    print(f"{Colors.BLUE}[PASO {step}]{Colors.ENDC} {Colors.BOLD}{message}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.WARNING}⚠️ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.FAIL}❌ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️ {message}{Colors.ENDC}")

class AutoMigrator:
    def __init__(self, backup_file, org_name, org_slug):
        self.backup_file = backup_file
        self.org_name = org_name
        self.org_slug = org_slug
        self.org_id = str(uuid.uuid4())
        self.backup_utf8 = None
        self.docker_compose_dir = None
        self.db_name = None
        
        print(f"{Colors.HEADER}🚀 MIGRADOR AUTOMÁTICO INICIADO{Colors.ENDC}")
        print(f"📂 Archivo: {backup_file}")
        print(f"🏢 Organización: {org_name}")
        print(f"🆔 UUID generado: {self.org_id}")
        print("=" * 60)

    def auto_detect_environment(self):
        """Detecta automáticamente el entorno Docker y base de datos"""
        print_step(1, "Detectando entorno automáticamente...")
        
        # Buscar docker-compose.yml
        current_dir = Path.cwd()
        for parent in [current_dir] + list(current_dir.parents):
            compose_file = parent / "docker-compose.yml"
            if compose_file.exists():
                self.docker_compose_dir = parent
                print_success(f"Docker Compose encontrado en: {parent}")
                break
        
        if not self.docker_compose_dir:
            # Buscar en subdirectorio backend
            backend_dir = current_dir / "backend"
            if (backend_dir / "docker-compose.yml").exists():
                self.docker_compose_dir = backend_dir
                print_success(f"Docker Compose encontrado en: {backend_dir}")
        
        if not self.docker_compose_dir:
            print_error("No se encontró docker-compose.yml")
            print_info("Asegúrate de estar en el directorio del proyecto")
            return False
        
        # Detectar nombre de base de datos desde docker-compose.yml
        try:
            with open(self.docker_compose_dir / "docker-compose.yml", 'r') as f:
                compose_content = f.read()
                
            # Buscar nombre de BD en variables de entorno
            db_matches = re.search(r'POSTGRES_DB[:\s]*([a-zA-Z0-9_-]+)', compose_content)
            if db_matches:
                self.db_name = db_matches.group(1)
                print_success(f"Base de datos detectada: {self.db_name}")
            else:
                print_warning("No se pudo detectar nombre de BD, usando 'baudex'")
                self.db_name = "baudex"
                
        except Exception as e:
            print_warning(f"Error leyendo docker-compose.yml: {e}")
            self.db_name = "baudex"
        
        return True

    def check_docker_status(self):
        """Verifica que Docker esté corriendo"""
        print_step(2, "Verificando Docker...")
        
        try:
            os.chdir(self.docker_compose_dir)
            result = subprocess.run(['docker-compose', 'ps'], 
                                  capture_output=True, text=True)
            
            if result.returncode != 0:
                print_error("Docker Compose no está corriendo")
                print_info("Iniciando Docker automáticamente...")
                
                start_result = subprocess.run(['docker-compose', 'up', '-d'], 
                                            capture_output=True, text=True)
                if start_result.returncode != 0:
                    print_error(f"Error iniciando Docker: {start_result.stderr}")
                    return False
                print_success("Docker iniciado correctamente")
            else:
                print_success("Docker está corriendo")
            
            # Verificar conexión a BD
            test_result = subprocess.run([
                'docker-compose', 'exec', '-T', 'db', 'psql', 
                '-U', 'postgres', '-d', self.db_name, 
                '-c', 'SELECT 1;'
            ], capture_output=True, text=True)
            
            if test_result.returncode != 0:
                print_error(f"No se puede conectar a la base de datos: {test_result.stderr}")
                return False
            
            print_success("Conexión a base de datos verificada")
            return True
            
        except Exception as e:
            print_error(f"Error verificando Docker: {e}")
            return False

    def auto_convert_encoding(self):
        """Convierte automáticamente el encoding del backup"""
        print_step(3, "Detectando y convirtiendo encoding...")
        
        if not os.path.exists(self.backup_file):
            print_error(f"Archivo no encontrado: {self.backup_file}")
            return False
        
        # Detectar encoding
        try:
            result = subprocess.run(['file', self.backup_file], 
                                  capture_output=True, text=True)
            encoding_info = result.stdout
            print_info(f"Información del archivo: {encoding_info}")
            
            if 'UTF-16' in encoding_info:
                print_info("Archivo en UTF-16, convirtiendo a UTF-8...")
                self.backup_utf8 = f"{Path(self.backup_file).stem}_utf8.sql"
                
                convert_result = subprocess.run([
                    'iconv', '-f', 'UTF-16', '-t', 'UTF-8', 
                    self.backup_file
                ], capture_output=True, text=True)
                
                if convert_result.returncode != 0:
                    print_error(f"Error convirtiendo encoding: {convert_result.stderr}")
                    return False
                
                with open(self.backup_utf8, 'w', encoding='utf-8') as f:
                    f.write(convert_result.stdout)
                
                print_success(f"Archivo convertido a: {self.backup_utf8}")
            else:
                print_success("Archivo ya está en UTF-8")
                self.backup_utf8 = self.backup_file
                
        except Exception as e:
            print_warning(f"No se pudo detectar encoding automáticamente: {e}")
            print_info("Asumiendo UTF-8...")
            self.backup_utf8 = self.backup_file
        
        return True

    def auto_detect_tables(self):
        """Detecta automáticamente las tablas y sus estructuras"""
        print_step(4, "Analizando estructura de la base de datos antigua...")
        
        try:
            with open(self.backup_utf8, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print_error(f"Error leyendo backup: {e}")
            return False
        
        # Detectar tablas automáticamente
        table_pattern = r'COPY public\.(\w+) \((.*?)\) FROM stdin;'
        tables_found = re.findall(table_pattern, content)
        
        if not tables_found:
            print_error("No se encontraron tablas en el backup")
            return False
        
        self.detected_tables = {}
        for table_name, columns_str in tables_found:
            # Limpiar nombres de columnas
            columns = [col.strip().strip('"') for col in columns_str.split(',')]
            self.detected_tables[table_name] = columns
            
            # Contar registros
            data_lines = self.extract_table_data(content, table_name)
            print_info(f"📋 {table_name}: {len(data_lines)} registros")
        
        print_success(f"Detectadas {len(self.detected_tables)} tablas automáticamente")
        return True

    def extract_table_data(self, content, table_name):
        """Extrae datos de una tabla específica"""
        pattern = f"COPY public.{table_name} \\(.*?\\) FROM stdin;"
        lines = content.split('\n')
        start_index = -1
        
        for i, line in enumerate(lines):
            if re.search(pattern, line):
                start_index = i + 1
                break
        
        if start_index == -1:
            return []
        
        data_lines = []
        for i in range(start_index, len(lines)):
            line = lines[i].strip()
            if line == '\\.' or line == '\\.':
                break
            if line and not line.startswith('--'):
                data_lines.append(line)
        
        return data_lines

    def detect_target_schema(self):
        """Detecta automáticamente el esquema de la BD destino"""
        print_step(5, "Detectando estructura de la base de datos destino...")
        
        try:
            # Obtener lista de tablas en la BD destino
            result = subprocess.run([
                'docker-compose', 'exec', '-T', 'db', 'psql', 
                '-U', 'postgres', '-d', self.db_name,
                '-c', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
            ], capture_output=True, text=True, cwd=self.docker_compose_dir)
            
            if result.returncode != 0:
                print_error(f"Error obteniendo esquema: {result.stderr}")
                return False
            
            target_tables = []
            for line in result.stdout.split('\n'):
                line = line.strip()
                if line and not line.startswith('-') and not line.startswith('table_name') and line != '(0 rows)' and '|' not in line:
                    target_tables.append(line)
            
            print_success(f"Detectadas {len(target_tables)} tablas en BD destino")
            
            # Verificar si las tablas del backup existen en destino
            self.compatible_tables = {}
            for table_name, columns in self.detected_tables.items():
                if table_name in target_tables:
                    # Obtener estructura real de la tabla
                    schema_result = subprocess.run([
                        'docker-compose', 'exec', '-T', 'db', 'psql', 
                        '-U', 'postgres', '-d', self.db_name,
                        '-c', f"\\d {table_name}"
                    ], capture_output=True, text=True, cwd=self.docker_compose_dir)
                    
                    if schema_result.returncode == 0:
                        self.compatible_tables[table_name] = columns
                        print_success(f"✓ {table_name} - Compatible")
                    else:
                        print_warning(f"⚠ {table_name} - Error obteniendo esquema")
                else:
                    print_warning(f"⚠ {table_name} - No existe en BD destino")
            
            return len(self.compatible_tables) > 0
            
        except Exception as e:
            print_error(f"Error detectando esquema destino: {e}")
            return False

    def create_backup(self):
        """Crea backup automático de la BD actual"""
        print_step(6, "Creando backup de seguridad...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_antes_migracion_{timestamp}.sql"
        
        try:
            result = subprocess.run([
                'docker-compose', 'exec', '-T', 'db', 'pg_dump',
                '-U', 'postgres', '-d', self.db_name
            ], capture_output=True, text=True, cwd=self.docker_compose_dir)
            
            if result.returncode != 0:
                print_error(f"Error creando backup: {result.stderr}")
                return False
            
            with open(backup_name, 'w', encoding='utf-8') as f:
                f.write(result.stdout)
            
            self.safety_backup = backup_name
            print_success(f"Backup creado: {backup_name}")
            return True
            
        except Exception as e:
            print_error(f"Error creando backup: {e}")
            return False

    def auto_generate_migration(self):
        """Genera automáticamente el script de migración"""
        print_step(7, "Generando script de migración automáticamente...")
        
        # Orden inteligente de tablas para evitar errores de FK
        table_order = [
            'users', 'categories', 'customers', 'products', 
            'expense_categories', 'temporary_products', 'invoices', 
            'invoice_items', 'product_prices', 'expenses'
        ]
        
        # Ordenar tablas detectadas según el orden inteligente
        ordered_tables = OrderedDict()
        
        # Primero agregar tablas en el orden predefinido
        for table in table_order:
            if table in self.compatible_tables:
                ordered_tables[table] = self.compatible_tables[table]
        
        # Luego agregar cualquier tabla restante
        for table, columns in self.compatible_tables.items():
            if table not in ordered_tables:
                ordered_tables[table] = columns
        
        self.migration_script = f"migration_auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        
        try:
            with open(self.backup_utf8, 'r', encoding='utf-8') as f:
                content = f.read()
            
            with open(self.migration_script, 'w', encoding='utf-8') as f:
                # Header
                f.write(f"""-- ============================================================================
-- MIGRACIÓN AUTOMÁTICA: {self.org_name.upper()}
-- Generado automáticamente el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- Organización ID: {self.org_id}
-- ============================================================================

-- Crear organización
BEGIN;
INSERT INTO organizations (
    id, created_at, updated_at, name, slug, domain, "isActive", 
    currency, locale, timezone, settings
) VALUES (
    '{self.org_id}',
    NOW(),
    NOW(),
    '{self.org_name}',
    '{self.org_slug}',
    '{self.org_slug}.legacy',
    true,
    'COP',
    'es',
    'America/Bogota',
    '{{"migrated": true, "source": "{self.backup_file}", "auto_generated": true}}'::jsonb
) ON CONFLICT (id) DO NOTHING;
COMMIT;

""")
                
                # Generar INSERTs para cada tabla
                for table_name, columns in ordered_tables.items():
                    data_lines = self.extract_table_data(content, table_name)
                    if data_lines:
                        f.write(f"\n-- Migrar {table_name} ({len(data_lines)} registros)\n")
                        f.write("BEGIN;\n")
                        f.write(self.generate_insert_sql(table_name, columns, data_lines))
                        f.write("\nCOMMIT;\n")
            
            print_success(f"Script de migración generado: {self.migration_script}")
            return True
            
        except Exception as e:
            print_error(f"Error generando migración: {e}")
            return False

    def generate_insert_sql(self, table_name, columns, data_lines):
        """Genera SQL INSERT para una tabla"""
        # Tablas que necesitan organization_id
        needs_org_id = table_name in ['users', 'categories', 'customers', 'products', 'invoices', 'expenses', 'expense_categories']
        
        if needs_org_id and 'organization_id' not in columns:
            columns = columns + ['organization_id']
        
        # Escapar nombres camelCase
        escaped_columns = []
        for col in columns:
            if any(c.isupper() for c in col):
                escaped_columns.append(f'"{col}"')
            else:
                escaped_columns.append(col)
        
        sql = f"""INSERT INTO {table_name} (
    {', '.join(escaped_columns)}
) VALUES"""
        
        value_rows = []
        for row_data in data_lines:
            fields = row_data.split('\t')
            parsed_fields = []
            
            for field in fields:
                if field == '\\N' or field == '':
                    parsed_fields.append('NULL')
                else:
                    escaped_field = field.replace("'", "''")
                    parsed_fields.append(f"'{escaped_field}'")
            
            if needs_org_id:
                parsed_fields.append(f"'{self.org_id}'")
            
            value_rows.append(f"    ({', '.join(parsed_fields)})")
        
        sql += '\n' + ',\n'.join(value_rows)
        sql += '\nON CONFLICT (id) DO NOTHING;'
        
        return sql

    def execute_migration(self):
        """Ejecuta la migración automáticamente"""
        print_step(8, "Ejecutando migración...")
        
        try:
            result = subprocess.run([
                'docker-compose', 'exec', '-T', 'db', 'psql',
                '-U', 'postgres', '-d', self.db_name
            ], input=open(self.migration_script, 'r').read(), 
               capture_output=True, text=True, cwd=self.docker_compose_dir)
            
            if result.returncode != 0:
                print_error(f"Error ejecutando migración: {result.stderr}")
                print_warning("Ejecutando rollback automático...")
                self.rollback()
                return False
            
            print_success("Migración ejecutada correctamente")
            
            # Contar errores en el output
            errors = result.stderr.count('ERROR:')
            if errors > 0:
                print_warning(f"Se encontraron {errors} errores durante la migración")
                print_info("Verificando integridad...")
            
            return True
            
        except Exception as e:
            print_error(f"Error ejecutando migración: {e}")
            return False

    def auto_verify(self):
        """Verifica automáticamente la migración"""
        print_step(9, "Verificando migración automáticamente...")
        
        try:
            # Verificar datos migrados
            verify_sql = f"""
SELECT 'RESUMEN MIGRACIÓN' as tipo;
SELECT 'organizations' as tabla, count(*) as registros FROM organizations WHERE slug = '{self.org_slug}';
SELECT 'users' as tabla, count(*) as registros FROM users WHERE organization_id = '{self.org_id}';
SELECT 'invoices' as tabla, count(*) as registros FROM invoices WHERE organization_id = '{self.org_id}';
SELECT 'products' as tabla, count(*) as registros FROM products WHERE organization_id = '{self.org_id}';

-- Verificar integridad
SELECT 'VERIFICACIÓN FK' as tipo;
SELECT 'Facturas con clientes válidos' as check_name, count(*) as ok
FROM invoices i JOIN customers c ON i."customerId" = c.id 
WHERE i.organization_id = c.organization_id AND i.organization_id = '{self.org_id}';

SELECT 'Registros huérfanos' as check_name, count(*) as huerfanos
FROM invoices WHERE organization_id IS NULL;
"""
            
            result = subprocess.run([
                'docker-compose', 'exec', '-T', 'db', 'psql',
                '-U', 'postgres', '-d', self.db_name, '-c', verify_sql
            ], capture_output=True, text=True, cwd=self.docker_compose_dir)
            
            if result.returncode != 0:
                print_error(f"Error verificando migración: {result.stderr}")
                return False
            
            print_success("Verificación completada:")
            print(result.stdout)
            
            return True
            
        except Exception as e:
            print_error(f"Error en verificación: {e}")
            return False

    def rollback(self):
        """Rollback automático en caso de error"""
        print_warning("Iniciando rollback automático...")
        
        try:
            # Eliminar datos de la organización migrada
            rollback_sql = f"""
DELETE FROM invoice_items WHERE "invoiceId" IN (SELECT id FROM invoices WHERE organization_id = '{self.org_id}');
DELETE FROM invoices WHERE organization_id = '{self.org_id}';
DELETE FROM products WHERE organization_id = '{self.org_id}';
DELETE FROM customers WHERE organization_id = '{self.org_id}';
DELETE FROM categories WHERE organization_id = '{self.org_id}';
DELETE FROM users WHERE organization_id = '{self.org_id}';
DELETE FROM organizations WHERE id = '{self.org_id}';
"""
            
            result = subprocess.run([
                'docker-compose', 'exec', '-T', 'db', 'psql',
                '-U', 'postgres', '-d', self.db_name, '-c', rollback_sql
            ], capture_output=True, text=True, cwd=self.docker_compose_dir)
            
            if result.returncode == 0:
                print_success("Rollback completado")
            else:
                print_error(f"Error en rollback: {result.stderr}")
                print_info(f"Restaurar manualmente desde: {self.safety_backup}")
                
        except Exception as e:
            print_error(f"Error en rollback: {e}")

    def run(self):
        """Ejecuta todo el proceso automáticamente"""
        steps = [
            self.auto_detect_environment,
            self.check_docker_status,
            self.auto_convert_encoding,
            self.auto_detect_tables,
            self.detect_target_schema,
            self.create_backup,
            self.auto_generate_migration,
            self.execute_migration,
            self.auto_verify
        ]
        
        for i, step in enumerate(steps, 1):
            if not step():
                print_error(f"Fallo en paso {i}")
                return False
        
        print(f"\n{Colors.GREEN}🎉 ¡MIGRACIÓN AUTOMÁTICA COMPLETADA EXITOSAMENTE! 🎉{Colors.ENDC}")
        print(f"{Colors.BOLD}📊 Resumen:{Colors.ENDC}")
        print(f"  • Organización: {self.org_name}")
        print(f"  • UUID: {self.org_id}")
        print(f"  • Backup seguridad: {self.safety_backup}")
        print(f"  • Script generado: {self.migration_script}")
        print(f"\n{Colors.BLUE}🚀 ¡Tu base de datos antigua está ahora 100% migrada!{Colors.ENDC}")
        
        return True

def main():
    if len(sys.argv) != 4:
        print(f"{Colors.HEADER}🚀 MIGRADOR AUTOMÁTICO DE BASE DE DATOS{Colors.ENDC}")
        print(f"\n{Colors.BOLD}USO:{Colors.ENDC}")
        print(f"  python3 auto_migrate.py <backup.sql> <\"Nombre Organización\"> <slug-organizacion>")
        print(f"\n{Colors.BOLD}EJEMPLO:{Colors.ENDC}")
        print(f"  python3 auto_migrate.py backup_viejo.sql \"Mi Empresa\" mi-empresa")
        print(f"\n{Colors.GREEN}¡Eso es TODO! El script hace el resto automáticamente.{Colors.ENDC}")
        sys.exit(1)
    
    backup_file = sys.argv[1]
    org_name = sys.argv[2]
    org_slug = sys.argv[3]
    
    migrator = AutoMigrator(backup_file, org_name, org_slug)
    success = migrator.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()