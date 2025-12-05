// src/credit-notes/services/credit-note-pdf.service.ts
import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { CreditNote } from '../entities/credit-note.entity';
import { Organization } from '../../organizations/entities/organization.entity';

const PdfPrinter = require('pdfmake');

@Injectable()
export class CreditNotePdfService {
  private printer: any;

  constructor() {
    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/build/vfs_fonts.js',
        bold: 'node_modules/pdfmake/build/vfs_fonts.js',
        italics: 'node_modules/pdfmake/build/vfs_fonts.js',
        bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
      },
    };

    this.printer = new PdfPrinter(fonts);
  }

  /**
   * Generar PDF de nota de crédito
   */
  async generateCreditNotePdf(
    creditNote: CreditNote,
    organization: Organization,
  ): Promise<Buffer> {
    const docDefinition = this.createCreditNoteDocument(creditNote, organization);

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        pdfDoc.on('end', () => {
          const result = Buffer.concat(chunks);
          resolve(result);
        });

        pdfDoc.on('error', (error) => {
          reject(error);
        });

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Crear documento de nota de crédito
   */
  private createCreditNoteDocument(
    creditNote: CreditNote,
    organization: Organization,
  ): TDocumentDefinitions {
    const content: any[] = [
      // Encabezado con logo y datos de la organización
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: organization.name || 'Mi Empresa',
                style: 'companyName',
              },
              {
                text: organization?.settings?.taxId
                  ? `NIT: ${organization.settings.taxId}`
                  : 'NIT: N/A',
                style: 'companyInfo',
              },
              {
                text: organization?.settings?.address || 'Dirección no disponible',
                style: 'companyInfo',
              },
              {
                text: organization?.settings?.phone
                  ? `Tel: ${organization.settings.phone}`
                  : 'Tel: N/A',
                style: 'companyInfo',
              },
              {
                text: organization?.settings?.email
                  ? `Email: ${organization.settings.email}`
                  : '',
                style: 'companyInfo',
              },
            ],
          },
          {
            width: 200,
            stack: [
              {
                text: 'NOTA DE CRÉDITO',
                style: 'invoiceTitle',
                alignment: 'right',
              },
              {
                text: `No. ${creditNote.number}`,
                style: 'invoiceNumber',
                alignment: 'right',
              },
              {
                text: `Fecha: ${this.formatDate(creditNote.date)}`,
                style: 'invoiceDate',
                alignment: 'right',
              },
              {
                text: `Estado: ${this.getStatusText(creditNote.status)}`,
                style: 'invoiceDate',
                alignment: 'right',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Línea separadora
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 2,
            lineColor: '#dc2626', // Rojo para distinguir de factura
          },
        ],
        margin: [0, 0, 0, 15],
      },

      // Referencia a factura
      {
        text: 'FACTURA DE REFERENCIA',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: `Factura No.: ${creditNote.invoice?.number || 'N/A'}`,
                style: 'customerInfo',
              },
              {
                text: `Fecha Factura: ${this.formatDate(creditNote.invoice?.date)}`,
                style: 'customerInfo',
              },
            ],
          },
          {
            width: 200,
            stack: [
              {
                text: `Tipo: ${this.getTypeText(creditNote.type)}`,
                style: 'customerInfo',
              },
              {
                text: `Razón: ${this.getReasonText(creditNote.reason)}`,
                style: 'customerInfo',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 15],
      },

      // Datos del cliente
      {
        text: 'DATOS DEL CLIENTE',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: `Cliente: ${creditNote.customer?.firstName || ''} ${creditNote.customer?.lastName || ''}`,
                style: 'customerInfo',
              },
              {
                text: creditNote.customer?.companyName
                  ? `Empresa: ${creditNote.customer.companyName}`
                  : '',
                style: 'customerInfo',
              },
              {
                text: (creditNote.customer as any)?.taxId
                  ? `${(creditNote.customer as any).identificationType || 'CC'}: ${(creditNote.customer as any).taxId}`
                  : '',
                style: 'customerInfo',
              },
            ],
          },
          {
            width: 200,
            stack: [
              {
                text: creditNote.customer?.address || 'Dirección: N/A',
                style: 'customerInfo',
              },
              {
                text: creditNote.customer?.phone
                  ? `Tel: ${creditNote.customer.phone}`
                  : '',
                style: 'customerInfo',
              },
              {
                text: creditNote.customer?.email
                  ? `Email: ${creditNote.customer.email}`
                  : '',
                style: 'customerInfo',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Descripción de la razón si existe
      ...(creditNote.reasonDescription
        ? [
            {
              text: 'DESCRIPCIÓN DE LA RAZÓN',
              style: 'sectionHeader',
              margin: [0, 0, 0, 10],
            },
            {
              text: creditNote.reasonDescription,
              style: 'customerInfo',
              margin: [0, 0, 0, 20],
            },
          ]
        : []),

      // Tabla de items
      {
        text: 'DETALLE DE LA NOTA DE CRÉDITO',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 50, 60, 60, 70],
          body: [
            // Encabezado
            [
              { text: 'Descripción', style: 'tableHeader' } as TableCell,
              { text: 'Cant.', style: 'tableHeader', alignment: 'center' } as TableCell,
              {
                text: 'Precio Unit.',
                style: 'tableHeader',
                alignment: 'right',
              } as TableCell,
              { text: 'Desc.', style: 'tableHeader', alignment: 'right' } as TableCell,
              { text: 'Subtotal', style: 'tableHeader', alignment: 'right' } as TableCell,
            ],
            // Items
            ...creditNote.items.map((item) => [
              {
                text: item.description,
                style: 'tableCell',
              } as TableCell,
              {
                text: item.quantity.toString(),
                style: 'tableCell',
                alignment: 'center',
              } as TableCell,
              {
                text: this.formatCurrency(item.unitPrice),
                style: 'tableCell',
                alignment: 'right',
              } as TableCell,
              {
                text: this.formatCurrency(item.discountAmount || 0),
                style: 'tableCell',
                alignment: 'right',
              } as TableCell,
              {
                text: this.formatCurrency(item.subtotal),
                style: 'tableCell',
                alignment: 'right',
              } as TableCell,
            ]),
          ],
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: (i) => (i === 1 ? '#dc2626' : '#e5e7eb'),
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      // Totales
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            stack: [
              {
                columns: [
                  { text: 'Subtotal:', style: 'totalLabel', width: 100 },
                  {
                    text: this.formatCurrency(creditNote.subtotal),
                    style: 'totalValue',
                    alignment: 'right',
                    width: '*',
                  },
                ],
                margin: [0, 0, 0, 5],
              },
              {
                columns: [
                  {
                    text: `IVA (${creditNote.taxPercentage}%):`,
                    style: 'totalLabel',
                    width: 100,
                  },
                  {
                    text: this.formatCurrency(creditNote.taxAmount),
                    style: 'totalValue',
                    alignment: 'right',
                    width: '*',
                  },
                ],
                margin: [0, 0, 0, 5],
              },
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 1,
                    lineColor: '#dc2626',
                  },
                ],
                margin: [0, 5, 0, 5],
              },
              {
                columns: [
                  { text: 'TOTAL CRÉDITO:', style: 'totalLabelBold', width: 100 },
                  {
                    text: this.formatCurrency(creditNote.total),
                    style: 'totalValueBold',
                    alignment: 'right',
                    width: '*',
                  },
                ],
                margin: [0, 0, 0, 5],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 30],
      },

      // Información de inventario
      ...(creditNote.restoreInventory
        ? [
            {
              text: `Restauración de inventario: ${creditNote.inventoryRestored ? 'Completada' : 'Pendiente'}`,
              style: 'notesText',
              margin: [0, 0, 0, 10],
            },
          ]
        : []),

      // Notas
      ...(creditNote.notes
        ? [
            {
              stack: [
                { text: 'NOTAS:', style: 'notesHeader' },
                { text: creditNote.notes, style: 'notesText' },
              ],
              margin: [0, 0, 0, 20],
            },
          ]
        : []),

      // Términos y condiciones
      ...(creditNote.terms
        ? [
            {
              stack: [
                { text: 'TÉRMINOS Y CONDICIONES:', style: 'notesHeader' },
                { text: creditNote.terms, style: 'notesText' },
              ],
              margin: [0, 0, 0, 20],
            },
          ]
        : []),

      // Pie de página
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: '#e5e7eb',
          },
        ],
        margin: [0, 20, 0, 10],
      },
      {
        text: 'Documento de crédito - No válido como factura',
        style: 'footer',
        alignment: 'center',
      },
    ];

    return {
      content,
      styles: {
        companyName: {
          fontSize: 18,
          bold: true,
          color: '#dc2626', // Rojo para nota de crédito
          margin: [0, 0, 0, 5],
        },
        companyInfo: {
          fontSize: 9,
          color: '#6b7280',
          margin: [0, 2, 0, 0],
        },
        invoiceTitle: {
          fontSize: 16,
          bold: true,
          color: '#dc2626',
          margin: [0, 0, 0, 5],
        },
        invoiceNumber: {
          fontSize: 14,
          bold: true,
          color: '#374151',
          margin: [0, 0, 0, 3],
        },
        invoiceDate: {
          fontSize: 9,
          color: '#6b7280',
          margin: [0, 2, 0, 0],
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          color: '#374151',
          fillColor: '#f3f4f6',
          margin: [0, 5, 0, 5],
        },
        customerInfo: {
          fontSize: 9,
          margin: [0, 2, 0, 0],
        },
        tableHeader: {
          fontSize: 9,
          bold: true,
          color: '#ffffff',
          fillColor: '#dc2626', // Rojo para tabla
        },
        tableCell: {
          fontSize: 9,
        },
        totalLabel: {
          fontSize: 10,
          color: '#374151',
        },
        totalValue: {
          fontSize: 10,
          color: '#374151',
        },
        totalLabelBold: {
          fontSize: 12,
          bold: true,
          color: '#dc2626',
        },
        totalValueBold: {
          fontSize: 12,
          bold: true,
          color: '#dc2626',
        },
        notesHeader: {
          fontSize: 10,
          bold: true,
          color: '#374151',
          margin: [0, 0, 0, 5],
        },
        notesText: {
          fontSize: 9,
          color: '#6b7280',
        },
        footer: {
          fontSize: 9,
          color: '#9ca3af',
          italics: true,
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
      pageMargins: [40, 40, 40, 60],
      footer: (currentPage, pageCount) => {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#9ca3af',
          margin: [0, 10, 0, 0],
        };
      },
    };
  }

  private formatDate(date: Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      DRAFT: 'Borrador',
      CONFIRMED: 'Confirmada',
      APPLIED: 'Aplicada',
      CANCELLED: 'Cancelada',
    };
    return statusMap[status] || status;
  }

  private getTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      FULL: 'Crédito Completo',
      PARTIAL: 'Crédito Parcial',
    };
    return typeMap[type] || type;
  }

  private getReasonText(reason: string): string {
    const reasonMap: Record<string, string> = {
      RETURNED_GOODS: 'Devolución de mercancía',
      PRICING_ERROR: 'Error en precio',
      DUPLICATE_INVOICE: 'Factura duplicada',
      ORDER_CANCELLATION: 'Cancelación de pedido',
      DAMAGED_GOODS: 'Mercancía dañada',
      QUANTITY_ERROR: 'Error en cantidad',
      QUALITY_ISSUE: 'Problema de calidad',
      OTHER: 'Otro',
    };
    return reasonMap[reason] || reason;
  }
}
