import os
import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Frame, PageTemplate
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from src.canvas.export import get_export_metadata

class PDFReportGenerator:
    def __init__(self, filename):
        self.filename = filename
        self.width, self.height = A4
        self.styles = getSampleStyleSheet()
        self.metadata = {}
        self._create_custom_styles()

    def _create_custom_styles(self):
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            leading=28,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#2c3e50')
        ))
        self.styles.add(ParagraphStyle(
            name='ReportSubtitle',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.gray
        ))
        self.styles.add(ParagraphStyle(
            name='StatNumber',
            parent=self.styles['Normal'],
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#2c3e50')
        ))
        self.styles.add(ParagraphStyle(
            name='StatLabel',
            parent=self.styles['Normal'],
            fontSize=9,
            alignment=TA_CENTER,
            textColor=colors.gray
        ))
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            alignment=TA_LEFT,
            textColor=colors.white
        ))
        self.styles.add(ParagraphStyle(
            name='CellText',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_LEFT,
            textColor=colors.black
        ))
        
    def clean_text(self, text):
        """Removes $ signs and trims whitespace."""
        if not text:
            return ""
        return str(text).replace('$', '').strip()

    def _header_footer(self, canvas, doc):
        """Draws the fixed header and footer on every page."""
        canvas.saveState()
        
        # --- Header ---
        # Top Left: Date/Time
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.gray)
        canvas.drawString(0.5 * inch, A4[1] - 0.5 * inch, f"{now}")
        
        # --- Footer Title Block ---
        footer_height = 0.95 * inch
        block_width = 3.9 * inch
        block_height = 1.05 * inch
        block_right = A4[0] - 0.5 * inch
        block_left = block_right - block_width
        block_bottom = 0.4 * inch
        block_top = block_bottom + block_height

        canvas.setStrokeColor(colors.HexColor('#C97B5A'))
        canvas.setFillColor(colors.HexColor('#FFF8F2'))
        canvas.roundRect(block_left, block_bottom, block_width, block_height, 8, stroke=1, fill=1)

        label_x = block_left + 0.16 * inch
        value_x = block_left + 1.2 * inch
        row_y = block_top - 0.26 * inch
        row_gap = 0.26 * inch

        metadata = self.metadata or {}
        rows = [
            ("Project Name", metadata.get("project_name", "Untitled Project")),
            ("Created By", metadata.get("created_by", "Unknown User")),
            ("Date", metadata.get("date", datetime.datetime.now().strftime('%B %d, %Y'))),
        ]

        canvas.setFont('Helvetica-Bold', 9)
        canvas.setFillColor(colors.HexColor('#6B4A3B'))
        for label, value in rows:
            canvas.drawString(label_x, row_y, f"{label}:")
            canvas.setFont('Helvetica', 9.5)
            canvas.drawString(value_x, row_y, str(value))
            canvas.setFont('Helvetica-Bold', 9)
            row_y -= row_gap

        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.gray)
        canvas.drawRightString(A4[0] - 0.5 * inch, 0.28 * inch, f"Page {canvas.getPageNumber()}")
        
        canvas.restoreState()

    def create_stat_card_table(self, data):
        """Creates the 4-column summary table."""
        # Data structure: [[(Num, Label), (Num, Label), ...]]
        
        total_items = len(data)
        # Count unique types (using Tag prefix or Description)
        types = set(d['type'] for d in data)
        doc_items = sum(1 for d in data if d['description'] and d['description'] != "Unknown Component")
        year = datetime.datetime.now().year
        
        stats = [
            (str(total_items), "Total Items"),
            (str(len(types)), "Equipment Types"),
            (str(doc_items), "Documented Items"),
            (str(year), "Report Year")
        ]
        
        # Build Table Data with Paragraphs
        row_nums = []
        row_labels = []
        
        for num, label in stats:
            row_nums.append(Paragraph(num, self.styles['StatNumber']))
            row_labels.append(Paragraph(label, self.styles['StatLabel']))
            
        # We want a single row with valid cell content, or two rows (Num, Label)?
        # The prompt says "Stat Card row". Let's do a single row where each cell handles its own content? 
        # Or easier: A table with 2 rows (Numbers, Labels)
        
        table_data = [row_nums, row_labels]
        
        # Column widths
        avail_width = self.width - 2*inch
        col_width = avail_width / 4
        
        t = Table(table_data, colWidths=[col_width]*4)
        t.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,0), 12),
            ('BOTTOMPADDING', (0,1), (-1,1), 12),
            # Optional: Add vertical lines or background to simulate "Cards"
            # For now, clean invisible borders as per "Stat Card row" description usually implies spacing
        ]))
        return t

    def generate(self, data, metadata=None):
        """
        Generates the PDF report.
        data: List of dicts with keys: 'tag', 'type', 'description', 's_no'
        """
        self.metadata = metadata or {}
        
        # 1. Clean Data
        cleaned_data = []
        for i, item in enumerate(data):
            cleaned_data.append({
                's_no': i + 1,
                'tag': self.clean_text(item.get('tag', '')),
                'type': self.clean_text(item.get('type', '')),
                'description': self.clean_text(item.get('description', ''))
            })
            
        story = []
        
        # 2. Title Section
        story.append(Paragraph("Equipment Inventory Report", self.styles['ReportTitle']))
        story.append(Paragraph(f"Generated on {datetime.datetime.now().strftime('%B %d, %Y')}", self.styles['ReportSubtitle']))
        story.append(Spacer(1, 0.5 * inch))
        
        # 3. Summary Stats
        story.append(self.create_stat_card_table(cleaned_data))
        story.append(Spacer(1, 0.5 * inch))
        
        # 4. Main Table
        # Headers
        headers = ["SI No", "Tag Number", "Equipment Type", "Description"]
        table_data = [[Paragraph(h, self.styles['TableHeader']) for h in headers]]
        
        # Rows
        for row in cleaned_data:
            table_data.append([
                str(row['s_no']),
                Paragraph(row['tag'], self.styles['CellText']),
                Paragraph(row['type'], self.styles['CellText']),
                Paragraph(row['description'], self.styles['CellText'])
            ])
            
        # Table Styling
        # Widths: SI=10%, Tag=20%, Type=20%, Desc=50%
        avail_width = self.width - 1.5*inch # Margins are 0.75 inch mostly? Let's check doc build
        # SimpleDocTemplate margins default to 1 inch.
        avail_width = self.width - 2*inch
        
        col_widths = [avail_width*0.1, avail_width*0.25, avail_width*0.25, avail_width*0.4]
        
        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2c3e50')), # Dark Header
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('TOPPADDING', (0,0), (-1,0), 8),
            
            # Rows
            ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,1), (-1,-1), 10),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
            ('TOPPADDING', (0,1), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0e0e0')), # Light borders
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f9f9f9')]) # Zebra striping
        ]))
        
        story.append(t)
        
        # Build Document
        doc = SimpleDocTemplate(
            self.filename,
            pagesize=A4,
            leftMargin=1*inch,
            rightMargin=1*inch,
            topMargin=1*inch,
            bottomMargin=1.2*inch
        )
        
        doc.build(story, onFirstPage=self._header_footer, onLaterPages=self._header_footer)
