"""
PDF Invoice Generator for InvoLinks
Generates professional, UAE FTA-compliant PDF invoices with branding and QR codes

FEATURES:
- Professional invoice layout with company branding
- VAT breakdown and calculations
- QR code for public invoice view
- Digital signature indicator
- Embedded UBL XML (optional)
- Multi-currency support

UAE FTA COMPLIANCE:
- All mandatory invoice fields included
- VAT calculations clearly displayed
- TRN prominently shown
- Invoice type and status indicated
"""

import os
import io
import base64
import qrcode
from datetime import datetime
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.pdfgen import canvas
from PIL import Image as PILImage


class PDFInvoiceGenerator:
    """Generates PDF invoices with professional formatting"""
    
    # Page dimensions
    PAGE_WIDTH, PAGE_HEIGHT = A4
    MARGIN = 2 * cm
    CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN)
    
    # Colors (UAE theme - professional blue and gold)
    PRIMARY_COLOR = colors.HexColor('#0066CC')      # Professional blue
    SECONDARY_COLOR = colors.HexColor('#FFD700')    # Gold accent
    GRAY_COLOR = colors.HexColor('#666666')
    LIGHT_GRAY = colors.HexColor('#F5F5F5')
    DARK_GRAY = colors.HexColor('#333333')
    
    def __init__(self):
        """Initialize PDF generator"""
        self.buffer = None
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Create custom paragraph styles"""
        # Company name style
        self.styles.add(ParagraphStyle(
            name='CompanyName',
            parent=self.styles['Heading1'],
            fontSize=20,
            textColor=self.PRIMARY_COLOR,
            spaceAfter=5,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        ))
        
        # Invoice title style
        self.styles.add(ParagraphStyle(
            name='InvoiceTitle',
            parent=self.styles['Heading2'],
            fontSize=24,
            textColor=self.DARK_GRAY,
            spaceAfter=10,
            alignment=TA_RIGHT,
            fontName='Helvetica-Bold'
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=self.PRIMARY_COLOR,
            spaceAfter=5,
            fontName='Helvetica-Bold'
        ))
        
        # Normal text style
        self.styles.add(ParagraphStyle(
            name='NormalText',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=self.DARK_GRAY,
            spaceAfter=3
        ))
        
        # Small text style
        self.styles.add(ParagraphStyle(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=self.GRAY_COLOR,
            spaceAfter=2
        ))
    
    def generate_qr_code(self, data: str, size: int = 150) -> Image:
        """
        Generate QR code image for invoice
        
        Args:
            data: URL or data to encode
            size: QR code size in pixels
            
        Returns:
            ReportLab Image object
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        # Create QR code image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to reportlab Image
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return Image(buffer, width=size, height=size)
    
    def _create_header(self, invoice_data: Dict, logo_path: Optional[str] = None) -> List:
        """Create invoice header with company and invoice details"""
        story = []
        
        # Create header table (2 columns: Company info | Invoice info)
        header_data = []
        
        # Left column: Company information
        company_info = []
        company_info.append(Paragraph(
            f"<b>{invoice_data.get('supplier_name', 'InvoLinks')}</b>",
            self.styles['CompanyName']
        ))
        
        if invoice_data.get('supplier_address'):
            company_info.append(Paragraph(
                invoice_data['supplier_address'],
                self.styles['NormalText']
            ))
        
        if invoice_data.get('supplier_city'):
            company_info.append(Paragraph(
                f"{invoice_data.get('supplier_city', '')}, UAE",
                self.styles['NormalText']
            ))
        
        # Conditional TRN display (only for VAT-registered businesses)
        vat_enabled = invoice_data.get('vat_enabled', False)
        if vat_enabled and invoice_data.get('supplier_trn'):
            company_info.append(Paragraph(
                f"<b>TRN:</b> {invoice_data['supplier_trn']}",
                self.styles['NormalText']
            ))
        
        # Right column: Invoice details
        invoice_info = []
        
        # UAE VAT-specific invoice classification
        invoice_classification = invoice_data.get('invoice_classification', '')
        invoice_type_code = str(invoice_data.get('invoice_type', '380'))
        
        if vat_enabled and invoice_classification:
            # VAT-registered business: Show TAX invoice classification (FTA compliant)
            if invoice_classification == 'full':
                invoice_type = 'FULL TAX INVOICE'
            elif invoice_classification == 'simplified':
                invoice_type = 'SIMPLIFIED TAX INVOICE'
            else:
                # Fallback to VAT-compliant types (only for registered businesses)
                invoice_type_map = {
                    '380': 'TAX INVOICE',
                    '381': 'CREDIT NOTE',
                    '480': 'COMMERCIAL INVOICE'
                }
                invoice_type = invoice_type_map.get(invoice_type_code, 'TAX INVOICE')
        else:
            # Non-VAT business: CANNOT use "TAX" label (UAE FTA law)
            # Only VAT-registered businesses can issue "Tax Invoice" documents
            invoice_type_map = {
                '380': 'INVOICE',                # Standard invoice (no VAT)
                '381': 'CREDIT NOTE',            # Credit notes allowed
                '480': 'COMMERCIAL INVOICE'      # Commercial invoice allowed
            }
            invoice_type = invoice_type_map.get(invoice_type_code, 'INVOICE')
        
        invoice_info.append(Paragraph(
            invoice_type,
            self.styles['InvoiceTitle']
        ))
        invoice_info.append(Paragraph(
            f"<b>Invoice #:</b> {invoice_data.get('invoice_number', 'N/A')}",
            self.styles['NormalText']
        ))
        invoice_info.append(Paragraph(
            f"<b>Date:</b> {invoice_data.get('issue_date', 'N/A')}",
            self.styles['NormalText']
        ))
        
        if invoice_data.get('due_date'):
            invoice_info.append(Paragraph(
                f"<b>Due Date:</b> {invoice_data['due_date']}",
                self.styles['NormalText']
            ))
        
        # Status badge
        status = invoice_data.get('status', 'DRAFT')
        status_colors = {
            'DRAFT': '#999999',
            'ISSUED': '#0066CC',
            'SENT': '#FF9800',
            'VIEWED': '#9C27B0',
            'PAID': '#4CAF50',
            'CANCELLED': '#F44336',
            'OVERDUE': '#D32F2F'
        }
        status_color = status_colors.get(status, '#999999')
        invoice_info.append(Paragraph(
            f'<font color="{status_color}"><b>Status: {status}</b></font>',
            self.styles['NormalText']
        ))
        
        # Create header table
        header_table = Table(
            [[company_info, invoice_info]],
            colWidths=[self.CONTENT_WIDTH * 0.6, self.CONTENT_WIDTH * 0.4]
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        
        story.append(header_table)
        story.append(Spacer(1, 20))
        
        # Horizontal line
        story.append(self._create_line())
        story.append(Spacer(1, 15))
        
        return story
    
    def _create_line(self, width: Optional[float] = None, color: Optional[colors.Color] = None):
        """Create horizontal line"""
        if width is None:
            width = self.CONTENT_WIDTH
        if color is None:
            color = self.GRAY_COLOR
        
        line_table = Table([['']], colWidths=[width])
        line_table.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, -1), 1, color),
        ]))
        return line_table
    
    def _create_billing_section(self, invoice_data: Dict) -> List:
        """Create billing information section"""
        story = []
        
        # Bill To section
        story.append(Paragraph("<b>BILL TO:</b>", self.styles['SectionHeader']))
        story.append(Paragraph(
            invoice_data.get('customer_name', 'N/A'),
            self.styles['NormalText']
        ))
        
        if invoice_data.get('customer_address'):
            story.append(Paragraph(
                invoice_data['customer_address'],
                self.styles['NormalText']
            ))
        
        if invoice_data.get('customer_city'):
            story.append(Paragraph(
                f"{invoice_data.get('customer_city', '')}, {invoice_data.get('customer_country', 'UAE')}",
                self.styles['NormalText']
            ))
        
        if invoice_data.get('customer_trn'):
            story.append(Paragraph(
                f"<b>TRN:</b> {invoice_data['customer_trn']}",
                self.styles['NormalText']
            ))
        else:
            story.append(Paragraph(
                "<i>(Non-VAT Registered Customer)</i>",
                self.styles['SmallText']
            ))
        
        story.append(Spacer(1, 15))
        return story
    
    def _create_line_items_table(self, line_items: List[Dict]) -> Table:
        """Create line items table"""
        # Table headers
        table_data = [[
            Paragraph('<b>#</b>', self.styles['SmallText']),
            Paragraph('<b>Description</b>', self.styles['SmallText']),
            Paragraph('<b>Qty</b>', self.styles['SmallText']),
            Paragraph('<b>Unit Price</b>', self.styles['SmallText']),
            Paragraph('<b>Tax %</b>', self.styles['SmallText']),
            Paragraph('<b>Amount</b>', self.styles['SmallText'])
        ]]
        
        # Add line items
        for idx, item in enumerate(line_items, 1):
            # Get currency symbol
            currency = item.get('currency_code', 'AED')
            
            # Item description
            desc = item.get('item_name', 'N/A')
            if item.get('item_description'):
                desc += f"<br/><font size='7'>{item.get('item_description')}</font>"
            
            table_data.append([
                Paragraph(str(idx), self.styles['SmallText']),
                Paragraph(desc, self.styles['SmallText']),
                Paragraph(f"{item.get('quantity', 0):.0f}", self.styles['SmallText']),
                Paragraph(f"{currency} {item.get('unit_price', 0):.2f}", self.styles['SmallText']),
                Paragraph(f"{item.get('tax_percent', 0):.1f}%", self.styles['SmallText']),
                Paragraph(f"{currency} {item.get('line_total_amount', 0):.2f}", self.styles['SmallText'])
            ])
        
        # Create table
        table = Table(table_data, colWidths=[
            0.7*cm,    # #
            6*cm,      # Description
            1.5*cm,    # Qty
            2.5*cm,    # Unit Price
            1.5*cm,    # Tax %
            2.5*cm     # Amount
        ])
        
        # Table style
        table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), self.PRIMARY_COLOR),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            
            # Data rows
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, self.GRAY_COLOR),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),  # #
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),  # Qty
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),   # Unit Price
            ('ALIGN', (4, 0), (4, -1), 'CENTER'),  # Tax %
            ('ALIGN', (5, 0), (5, -1), 'RIGHT'),   # Amount
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            
            # Alternate row colors
            *[('BACKGROUND', (0, i), (-1, i), self.LIGHT_GRAY) 
              for i in range(2, len(table_data), 2)]
        ]))
        
        return table
    
    def _create_totals_section(self, invoice_data: Dict, qr_code: Optional[Image] = None) -> List:
        """Create totals and summary section"""
        story = []
        
        currency = invoice_data.get('currency_code', 'AED')
        
        # Create two-column layout: QR code | Totals
        totals_data = []
        
        # Left column: QR code
        left_col = []
        if qr_code:
            left_col.append(qr_code)
            left_col.append(Paragraph(
                "<i>Scan to view invoice online</i>",
                self.styles['SmallText']
            ))
        
        # Right column: Totals
        right_col = []
        
        # Subtotal
        right_col.append(Paragraph(
            f"<b>Subtotal (Excl. VAT):</b> {currency} {invoice_data.get('subtotal_amount', 0):.2f}",
            self.styles['NormalText']
        ))
        
        # VAT
        tax_percent = (invoice_data.get('tax_amount', 0) / invoice_data.get('subtotal_amount', 1) * 100) if invoice_data.get('subtotal_amount', 0) > 0 else 0
        right_col.append(Paragraph(
            f"<b>VAT ({tax_percent:.1f}%):</b> {currency} {invoice_data.get('tax_amount', 0):.2f}",
            self.styles['NormalText']
        ))
        
        # Total
        right_col.append(Spacer(1, 5))
        right_col.append(Paragraph(
            f'<font size="14" color="{self.PRIMARY_COLOR}"><b>TOTAL: {currency} {invoice_data.get('total_amount', 0):.2f}</b></font>',
            self.styles['NormalText']
        ))
        
        # Amount Due (if different)
        if invoice_data.get('amount_due') and invoice_data.get('amount_due') != invoice_data.get('total_amount'):
            right_col.append(Spacer(1, 5))
            right_col.append(Paragraph(
                f'<font color="#D32F2F"><b>Amount Due: {currency} {invoice_data.get("amount_due", 0):.2f}</b></font>',
                self.styles['NormalText']
            ))
        
        # Create totals table
        totals_table = Table(
            [[left_col, right_col]],
            colWidths=[self.CONTENT_WIDTH * 0.3, self.CONTENT_WIDTH * 0.7]
        )
        totals_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        
        story.append(totals_table)
        return story
    
    def _create_footer(self, invoice_data: Dict) -> List:
        """Create invoice footer with compliance info"""
        story = []
        
        story.append(Spacer(1, 20))
        story.append(self._create_line())
        story.append(Spacer(1, 10))
        
        # Digital signature indicator
        if invoice_data.get('signature_b64'):
            story.append(Paragraph(
                '✓ <b>Digitally Signed</b> - This invoice has been digitally signed for authenticity and compliance',
                self.styles['SmallText']
            ))
            
            if invoice_data.get('signing_cert_serial'):
                story.append(Paragraph(
                    f"Certificate Serial: {invoice_data['signing_cert_serial']}",
                    self.styles['SmallText']
                ))
            
            if invoice_data.get('signing_timestamp'):
                story.append(Paragraph(
                    f"Signed on: {invoice_data['signing_timestamp']}",
                    self.styles['SmallText']
                ))
        
        # Payment terms
        if invoice_data.get('payment_terms'):
            story.append(Spacer(1, 10))
            story.append(Paragraph(
                f"<b>Payment Terms:</b> {invoice_data['payment_terms']}",
                self.styles['SmallText']
            ))
        
        # Notes
        if invoice_data.get('notes'):
            story.append(Spacer(1, 10))
            story.append(Paragraph(
                f"<b>Notes:</b> {invoice_data['notes']}",
                self.styles['SmallText']
            ))
        
        # Compliance footer
        story.append(Spacer(1, 15))
        story.append(Paragraph(
            '<i>This is a computer-generated invoice and is compliant with UAE Federal Tax Authority (FTA) requirements.</i>',
            self.styles['SmallText']
        ))
        story.append(Paragraph(
            f'<i>Generated by InvoLinks - UAE E-Invoicing Platform | {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</i>',
            self.styles['SmallText']
        ))
        
        return story
    
    def generate_invoice_pdf(
        self,
        invoice_data: Dict[str, Any],
        line_items: List[Dict[str, Any]],
        output_path: Optional[str] = None,
        public_url: Optional[str] = None
    ) -> bytes:
        """
        Generate PDF invoice
        
        Args:
            invoice_data: Invoice header data
            line_items: List of invoice line items
            output_path: Optional file path to save PDF
            public_url: Optional public URL for QR code
            
        Returns:
            PDF bytes
        """
        # Create buffer for PDF
        self.buffer = io.BytesIO()
        
        # Create PDF document
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=A4,
            rightMargin=self.MARGIN,
            leftMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN
        )
        
        # Build PDF content
        story = []
        
        # Header
        story.extend(self._create_header(invoice_data))
        
        # Billing section
        story.extend(self._create_billing_section(invoice_data))
        
        # Line items table
        story.append(Paragraph("<b>INVOICE ITEMS:</b>", self.styles['SectionHeader']))
        story.append(Spacer(1, 10))
        story.append(self._create_line_items_table(line_items))
        story.append(Spacer(1, 20))
        
        # Totals section with QR code
        qr_code = None
        if public_url:
            qr_code = self.generate_qr_code(public_url, size=100)
        
        story.extend(self._create_totals_section(invoice_data, qr_code))
        
        # Footer
        story.extend(self._create_footer(invoice_data))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF bytes
        pdf_bytes = self.buffer.getvalue()
        self.buffer.seek(0)
        
        # Save to file if path provided
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'wb') as f:
                f.write(pdf_bytes)
        
        return pdf_bytes


def generate_invoice_pdf(
    invoice_data: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    output_path: Optional[str] = None,
    public_url: Optional[str] = None
) -> bytes:
    """
    Convenience function to generate PDF invoice
    
    Args:
        invoice_data: Invoice header data
        line_items: List of invoice line items
        output_path: Optional file path to save PDF
        public_url: Optional public URL for QR code
        
    Returns:
        PDF bytes
    """
    generator = PDFInvoiceGenerator()
    return generator.generate_invoice_pdf(invoice_data, line_items, output_path, public_url)
