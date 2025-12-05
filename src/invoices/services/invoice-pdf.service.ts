import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { Invoice } from '../entities/invoice.entity';
import { Organization } from '../../organizations/entities/organization.entity';

const PdfPrinter = require('pdfmake');

@Injectable()
export class InvoicePdfService {
  private printer: any;

  constructor() {
    // Configurar fuentes para pdfmake
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
   * Generar PDF de factura
   */
  async generateInvoicePdf(
    invoice: Invoice,
    organization: Organization,
  ): Promise<Buffer> {
    const docDefinition = this.createInvoiceDocument(invoice, organization);

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
   * Crear documento de factura
   */
  private createInvoiceDocument(
    invoice: Invoice,
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
                text: 'FACTURA DE VENTA',
                style: 'invoiceTitle',
                alignment: 'right',
              },
              {
                text: `No. ${invoice.number}`,
                style: 'invoiceNumber',
                alignment: 'right',
              },
              {
                text: `Fecha: ${this.formatDate(invoice.date)}`,
                style: 'invoiceDate',
                alignment: 'right',
              },
              {
                text: `Vencimiento: ${this.formatDate(invoice.dueDate)}`,
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
            lineColor: '#3b82f6',
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
                text: `Cliente: ${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`,
                style: 'customerInfo',
              },
              {
                text: invoice.customer?.companyName
                  ? `Empresa: ${invoice.customer.companyName}`
                  : '',
                style: 'customerInfo',
              },
              {
                text: (invoice.customer as any)?.taxId
                  ? `${(invoice.customer as any).identificationType || 'CC'}: ${(invoice.customer as any).taxId}`
                  : '',
                style: 'customerInfo',
              },
            ],
          },
          {
            width: 200,
            stack: [
              {
                text: invoice.customer?.address || 'Dirección: N/A',
                style: 'customerInfo',
              },
              {
                text: invoice.customer?.phone
                  ? `Tel: ${invoice.customer.phone}`
                  : '',
                style: 'customerInfo',
              },
              {
                text: invoice.customer?.email
                  ? `Email: ${invoice.customer.email}`
                  : '',
                style: 'customerInfo',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Tabla de items
      {
        text: 'DETALLE DE LA FACTURA',
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
            ...invoice.items.map((item) => [
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
          hLineColor: (i) => (i === 1 ? '#3b82f6' : '#e5e7eb'),
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
                    text: this.formatCurrency(invoice.subtotal),
                    style: 'totalValue',
                    alignment: 'right',
                    width: '*',
                  },
                ],
                margin: [0, 0, 0, 5],
              },
              ...(invoice.discountAmount > 0
                ? [
                    {
                      columns: [
                        {
                          text: `Descuento (${invoice.discountPercentage}%):`,
                          style: 'totalLabel',
                          width: 100,
                        },
                        {
                          text: this.formatCurrency(invoice.discountAmount),
                          style: 'totalValue',
                          alignment: 'right',
                          width: '*',
                        },
                      ],
                      margin: [0, 0, 0, 5],
                    },
                  ]
                : []),
              {
                columns: [
                  {
                    text: `IVA (${invoice.taxPercentage}%):`,
                    style: 'totalLabel',
                    width: 100,
                  },
                  {
                    text: this.formatCurrency(invoice.taxAmount),
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
                    lineColor: '#3b82f6',
                  },
                ],
                margin: [0, 5, 0, 5],
              },
              {
                columns: [
                  { text: 'TOTAL:', style: 'totalLabelBold', width: 100 },
                  {
                    text: this.formatCurrency(invoice.total),
                    style: 'totalValueBold',
                    alignment: 'right',
                    width: '*',
                  },
                ],
                margin: [0, 0, 0, 5],
              },
              ...(invoice.paidAmount > 0
                ? [
                    {
                      columns: [
                        { text: 'Pagado:', style: 'totalLabel', width: 100 },
                        {
                          text: this.formatCurrency(invoice.paidAmount),
                          style: 'totalValue',
                          alignment: 'right',
                          width: '*',
                        },
                      ],
                      margin: [0, 0, 0, 5],
                    },
                  ]
                : []),
              ...(invoice.balanceDue > 0
                ? [
                    {
                      columns: [
                        { text: 'Saldo:', style: 'totalLabel', width: 100 },
                        {
                          text: this.formatCurrency(invoice.balanceDue),
                          style: 'totalValue',
                          alignment: 'right',
                          width: '*',
                          color: '#dc2626',
                        },
                      ],
                      margin: [0, 0, 0, 5],
                    },
                  ]
                : []),
            ],
          },
        ],
        margin: [0, 0, 0, 30],
      },

      // Notas
      ...(invoice.notes
        ? [
            {
              stack: [
                { text: 'NOTAS:', style: 'notesHeader' },
                { text: invoice.notes, style: 'notesText' },
              ],
              margin: [0, 0, 0, 20],
            },
          ]
        : []),

      // Términos y condiciones
      ...(invoice.terms
        ? [
            {
              stack: [
                { text: 'TÉRMINOS Y CONDICIONES:', style: 'notesHeader' },
                { text: invoice.terms, style: 'notesText' },
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
        text: 'Gracias por su compra',
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
          color: '#1e40af',
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
          color: '#1e40af',
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
          fillColor: '#3b82f6',
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
          color: '#1e40af',
        },
        totalValueBold: {
          fontSize: 12,
          bold: true,
          color: '#1e40af',
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

  /**
   * Formatear fecha
   */
  private formatDate(date: Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formatear moneda
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }
}
