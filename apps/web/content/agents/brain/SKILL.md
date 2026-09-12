# BRAIN 🧠 - The True Hacker Agent

## Core Arsenal: Python Power Tools

### 1. python-docx Mastery
```python
# Document automation at its finest
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.oxml.shared import OxmlElement, qn

# Advanced techniques:
- Custom styles and formatting
- Table manipulation and automation
- Header/footer dynamic content
- Mail merge automation
- Template system creation
- Corporate document standardization
```

### 2. python-pptx Excellence
```python
# Mary Meeker-level presentation building
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

# Capabilities:
- Data-driven slide generation
- Chart automation from datasets
- Template-based presentation systems
- Batch slide creation
- Interactive element integration
- Multi-language presentation support
```

### 3. Pandas Data Wrestling
```python
import pandas as pd
import numpy as np

# Data manipulation supremacy:
- Complex data transformations
- Time series analysis
- Financial modeling datasets
- Performance optimization
- Memory-efficient processing
- Advanced aggregations and pivots
```

### 4. Pillow (PIL) Image Processing
```python
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from PIL.ImageColor import getcolor
import PIL.ImageOps

# Visual excellence:
- CMYK color space conversion
- Print-ready image optimization
- Batch image processing
- Brand asset automation
- Logo placement and watermarking
- Advanced filtering and effects
```

### 5. openpyxl Excel Mastery
```python
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Border
from openpyxl.chart import LineChart, BarChart

# Spreadsheet supremacy:
- Complex financial models
- Automated report generation
- Chart and visualization integration
- Formula automation
- Data validation systems
- Template-based workflows
```

### 6. D3.js Visualization Excellence
```javascript
// Advanced data visualization with D3.js
import * as d3 from 'd3';

// Capabilities:
- Interactive data visualizations
- Custom chart types beyond standard libraries
- Real-time data binding and updates
- SVG-based scalable graphics
- Complex multi-dimensional displays
- Geographic data visualization
- Network/graph visualizations
- Animation and transitions
```

### 7. Mermaid Diagram Mastery
```javascript
// Programmatic diagram generation
const mermaid = require('mermaid');

// Diagram types:
- Flowcharts and process flows
- Sequence diagrams for API documentation
- Gantt charts for project timelines
- Class diagrams for system architecture
- State diagrams for business logic
- User journey maps
- Entity relationship diagrams
- Git workflows and branching strategies
```

## Mary Meeker Presentation Architecture

### Data Density Principles
1. **Authentic Source Preservation**
   - Maintain original data formatting
   - Preserve source credibility
   - Avoid over-designing raw data
   
2. **Rapid Narrative Support**
   - 300+ slides in 30 minutes
   - Impression-focused delivery
   - Detail-rich for post-consumption

3. **Global Perspective Integration**
   - International market data
   - Emerging market insights
   - Cross-platform comparisons

### Presentation Structure Patterns
```yaml
Slide Categories:
  Foundation Slides:
    - Internet user growth
    - Mobile adoption trends
    - Platform statistics
    
  Analysis Slides:
    - Comparative performance
    - Trend identification
    - Market opportunity sizing
    
  Prediction Slides:
    - Forward-looking indicators
    - Investment thesis support
    - Risk assessment
```

## CMYK Brand System Excellence

### Color Management Mastery
```python
# CMYK precision for print production
def convert_rgb_to_cmyk(r, g, b):
    """Convert RGB to CMYK with professional accuracy"""
    r, g, b = r/255.0, g/255.0, b/255.0
    k = 1 - max(r, g, b)
    c = (1-r-k) / (1-k) if (1-k) != 0 else 0
    m = (1-g-k) / (1-k) if (1-k) != 0 else 0
    y = (1-b-k) / (1-k) if (1-k) != 0 else 0
    return (c*100, m*100, y*100, k*100)

# Brand color specifications
brand_colors = {
    'primary': {'cmyk': (85, 15, 0, 0), 'name': 'Derozic Blue'},
    'secondary': {'cmyk': (0, 85, 85, 0), 'name': 'Derozic Orange'},
    'accent': {'cmyk': (0, 0, 0, 90), 'name': 'Derozic Charcoal'}
}
```

### Typography System Design
```python
# Professional typography hierarchy
typography_system = {
    'display': {
        'family': 'Helvetica Neue Bold',
        'sizes': {'desktop': 48, 'tablet': 36, 'mobile': 28},
        'line_height': 1.2,
        'letter_spacing': -0.02
    },
    'heading': {
        'family': 'Helvetica Neue Medium', 
        'sizes': {'desktop': 32, 'tablet': 24, 'mobile': 20},
        'line_height': 1.3
    },
    'body': {
        'family': 'Helvetica Neue Regular',
        'sizes': {'desktop': 16, 'tablet': 14, 'mobile': 14},
        'line_height': 1.5
    }
}
```

## Advanced Automation Workflows

### 1. Brand Asset Pipeline
```python
class BrandAssetGenerator:
    def __init__(self, brand_config):
        self.brand = brand_config
        
    def generate_logo_variants(self):
        """Create all logo variants: full, mark, mono, reverse"""
        pass
        
    def create_business_cards(self):
        """Generate print-ready business card templates"""
        pass
        
    def build_presentation_template(self):
        """Create branded PowerPoint template"""
        pass
        
    def export_brand_guidelines(self):
        """Generate comprehensive brand guideline document"""
        pass
```

### 2. Financial Report Automation
```python
class FinancialReportBuilder:
    def __init__(self, data_source):
        self.data = pd.read_csv(data_source)
        
    def generate_executive_summary(self):
        """Create one-page financial summary"""
        pass
        
    def build_detailed_analysis(self):
        """Multi-sheet Excel analysis with charts"""
        pass
        
    def create_investor_deck(self):
        """Build investor presentation with data visualizations"""
        pass
```

### 3. Mary Meeker Style Presentation Generator
```python
class MeekerStylePresentation:
    def __init__(self, data_sources):
        self.data_sources = data_sources
        self.slide_count = 0
        
    def create_trend_slide(self, title, dataset, trend_type):
        """Generate authentic trend visualization slide"""
        # Preserve original data formatting
        # Create high-density information layout
        # Add source attribution
        pass
        
    def build_comparative_analysis(self, datasets):
        """Create side-by-side comparison slides"""
        pass
        
    def generate_global_perspective(self, markets):
        """Add international market context"""
        pass
        
    def compile_internet_trends_deck(self):
        """Full Internet Trends style presentation"""
        slides = []
        
        # Foundation: Internet growth metrics
        slides.extend(self.create_foundation_slides())
        
        # Mobile: Platform adoption trends  
        slides.extend(self.create_mobile_analysis())
        
        # Commerce: E-commerce evolution
        slides.extend(self.create_commerce_trends())
        
        # Emerging: New technology adoption
        slides.extend(self.create_emerging_tech())
        
        # International: Global market data
        slides.extend(self.create_global_analysis())
        
        return slides
```

## Figma Integration Capabilities

### Design System Automation
```python
# Figma API integration for design systems
import requests
import json

class FigmaDesignSystemSync:
    def __init__(self, figma_token, file_key):
        self.token = figma_token
        self.file_key = file_key
        self.base_url = "https://api.figma.com/v1"
        
    def extract_design_tokens(self):
        """Extract colors, typography, spacing from Figma"""
        pass
        
    def generate_code_tokens(self):
        """Convert Figma design tokens to code variables"""
        pass
        
    def sync_component_library(self):
        """Sync Figma components to development templates"""
        pass
```

## Performance Optimization Techniques

### 1. Memory-Efficient Processing
```python
# Large dataset handling
def process_large_dataset(file_path, chunk_size=10000):
    """Process large files without memory overflow"""
    for chunk in pd.read_csv(file_path, chunksize=chunk_size):
        # Process chunk
        yield process_chunk(chunk)

# Lazy evaluation for presentations
def lazy_slide_generation(data_generator):
    """Generate slides on-demand"""
    for data_chunk in data_generator:
        yield create_slide_from_data(data_chunk)
```

### 2. Parallel Processing
```python
from multiprocessing import Pool
import concurrent.futures

def parallel_image_processing(image_list):
    """Process multiple images simultaneously"""
    with Pool() as pool:
        results = pool.map(process_image, image_list)
    return results

def concurrent_report_generation(report_configs):
    """Generate multiple reports concurrently"""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(generate_report, config) 
                  for config in report_configs]
        return [future.result() for future in futures]
```

## Brand System Templates

### 1. Complete Brand Package
```python
brand_deliverables = {
    'logo_suite': [
        'primary_logo.eps',
        'logo_mark.eps', 
        'monochrome.eps',
        'reverse.eps'
    ],
    'color_palette': {
        'primary_colors': ['#FF6B35', '#004E89'],
        'secondary_colors': ['#FFB627', '#00A8CC'],
        'neutral_colors': ['#F5F5F5', '#333333']
    },
    'typography': {
        'primary': 'Helvetica Neue',
        'secondary': 'Georgia',
        'mono': 'Courier New'
    },
    'templates': [
        'business_card.docx',
        'letterhead.docx', 
        'presentation.pptx',
        'invoice.xlsx'
    ]
}
```

### 2. Automated Style Guide Generation
```python
def generate_brand_guidelines(brand_config):
    """Create comprehensive brand guideline document"""
    doc = Document()
    
    # Cover page with logo
    add_cover_page(doc, brand_config)
    
    # Logo usage guidelines  
    add_logo_guidelines(doc, brand_config)
    
    # Color palette with CMYK values
    add_color_specifications(doc, brand_config)
    
    # Typography hierarchy
    add_typography_guide(doc, brand_config)
    
    # Application examples
    add_application_examples(doc, brand_config)
    
    return doc
```

## Advanced Visualization Workflows

### 1. D3.js Interactive Dashboard Creation
```javascript
// Real-time financial dashboard
class FinancialDashboard {
    constructor(containerId, dataStream) {
        this.container = d3.select(`#${containerId}`);
        this.dataStream = dataStream;
        this.charts = {};
    }
    
    createRevenueChart() {
        const margin = {top: 20, right: 30, bottom: 40, left: 40};
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        
        // Create responsive SVG with real-time data binding
        const svg = this.container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
            
        // Implement smooth transitions and animations
        // Add interactive tooltips and zoom functionality
    }
    
    updateDataRealTime(newData) {
        // Seamless data updates with D3's data binding
        // Smooth transitions between states
    }
}

// Geographic visualization for global market data
class GlobalMarketMap {
    constructor(worldData, marketData) {
        this.projection = d3.geoNaturalEarth1();
        this.path = d3.geoPath().projection(this.projection);
    }
    
    renderCountryData() {
        // Choropleth mapping with market performance
        // Interactive hover states and drill-down capability
    }
}
```

### 2. Mermaid Documentation Automation
```javascript
// Automated system architecture documentation
class SystemDocumentationGenerator {
    generateSequenceDiagram(apiEndpoints) {
        return `
        sequenceDiagram
            participant Client
            participant Gateway
            participant Auth
            participant Database
            
            ${apiEndpoints.map(endpoint => 
                `Client->>Gateway: ${endpoint.method} ${endpoint.path}
                Gateway->>Auth: Validate Token
                Auth-->>Gateway: Token Valid
                Gateway->>Database: ${endpoint.operation}
                Database-->>Gateway: Response Data
                Gateway-->>Client: ${endpoint.response}`
            ).join('\n')}
        `;
    }
    
    generateFlowchart(businessProcess) {
        // Auto-generate process flow documentation
        return `
        flowchart TD
            A[Start Process] --> B{Validation Check}
            B -->|Valid| C[Process Request]
            B -->|Invalid| D[Return Error]
            C --> E[Update Database]
            E --> F[Send Notification]
            F --> G[End]
        `;
    }
    
    generateGanttChart(projectTimeline) {
        // Project management visualization
        return `
        gantt
            title Project Development Timeline
            dateFormat YYYY-MM-DD
            section Planning
            Requirements Gathering :active, req, 2024-01-01, 2024-01-15
            Architecture Design    :arch, after req, 10d
            section Development
            Backend Implementation :backend, after arch, 20d
            Frontend Development  :frontend, after arch, 25d
        `;
    }
}

// Brand system documentation with Mermaid
class BrandSystemDiagrammer {
    generateComponentHierarchy(components) {
        return `
        graph TB
            Brand[Brand System]
            Brand --> Colors[Color Palette]
            Brand --> Typography[Typography]
            Brand --> Components[UI Components]
            
            Colors --> Primary[Primary Colors]
            Colors --> Secondary[Secondary Colors]
            Colors --> Neutral[Neutral Palette]
            
            Components --> Buttons[Button System]
            Components --> Forms[Form Components]
            Components --> Navigation[Navigation]
        `;
    }
}
```

### 3. Integrated Visualization Pipeline
```python
# Python to D3.js data pipeline
class VisualizationPipeline:
    def __init__(self, data_source):
        self.data = pd.read_csv(data_source)
        
    def prepare_for_d3(self):
        """Transform pandas data for D3.js consumption"""
        # Optimize data structure for web performance
        # Generate JSON with proper nesting for D3 hierarchies
        pass
        
    def generate_dashboard_config(self):
        """Create configuration for interactive dashboards"""
        return {
            'charts': self.identify_optimal_chart_types(),
            'interactions': self.define_user_interactions(),
            'responsive': self.calculate_breakpoints(),
            'performance': self.optimize_for_speed()
        }

# Automated Mermaid diagram generation from code
def generate_mermaid_from_functions(python_file):
    """Analyze Python code and generate call flow diagrams"""
    import ast
    
    with open(python_file, 'r') as f:
        tree = ast.parse(f.read())
    
    # Extract function calls and relationships
    # Generate mermaid flowchart showing code structure
    return mermaid_flowchart
```

## Integration with External Tools

### 1. Adobe Creative Suite Preparation
```python
def prepare_for_adobe(assets):
    """Optimize assets for Adobe Creative Suite"""
    for asset in assets:
        if asset.format == 'image':
            # Convert to Adobe RGB color space
            # Set appropriate DPI for print
            # Generate multiple format variants
            pass
```

### 2. Print Production Optimization
```python
def optimize_for_print(document, print_specs):
    """Prepare documents for professional printing"""
    # Convert colors to CMYK
    # Set bleeds and margins
    # Embed fonts
    # Generate PDF/X-1a compliant files
    pass
```

## Continuous Learning & Pattern Recognition

### 1. Style Pattern Analysis
```python
def analyze_successful_presentations(presentation_db):
    """Learn from high-performing presentations"""
    patterns = {
        'slide_count': [],
        'data_density': [],
        'color_usage': [],
        'font_choices': []
    }
    
    for pres in presentation_db:
        patterns['slide_count'].append(count_slides(pres))
        patterns['data_density'].append(calculate_density(pres))
        # ... analyze other patterns
    
    return optimize_future_presentations(patterns)
```

### 2. Brand Consistency Monitoring
```python
def audit_brand_compliance(asset_directory):
    """Automatically check brand guideline compliance"""
    compliance_report = {
        'color_accuracy': check_color_compliance(),
        'font_usage': validate_typography(),
        'logo_placement': verify_logo_standards(),
        'spacing_adherence': measure_spacing_consistency()
    }
    return compliance_report
```

## Best Practices & Standards

1. **Always preserve data authenticity in presentations**
2. **Use CMYK for all print-intended designs**
3. **Implement comprehensive error handling in automation**
4. **Optimize for both speed and quality**
5. **Create scalable template systems**
6. **Document all custom functions and workflows**
7. **Test outputs across different platforms and devices**
8. **Maintain consistent naming conventions**
9. **Version control all template and automation assets**
10. **Regular performance profiling and optimization**