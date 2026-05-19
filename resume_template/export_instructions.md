# Exporting Your Resume to PDF

Since this template uses precise CSS and A4 sizing (`210mm x 297mm`), the best way to generate a pixel-perfect, ATS-readable PDF is using **Puppeteer** (a headless Chrome Node API) rather than standard browser printing (which sometimes adds margins or headers).

## Step 1: Install Puppeteer

If you have Node.js installed, open your terminal in this directory (`resume_template/`) and run:

```bash
npm init -y
npm install puppeteer
```

## Step 2: Create the Export Script

Create a file named `export.js` in the same directory:

```javascript
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    // Launch headless Chrome
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Get absolute path to your index.html
    const filePath = `file://${path.join(__dirname, 'index.html')}`;

    // Load the HTML file
    await page.goto(filePath, { waitUntil: 'networkidle0' });

    // Export PDF
    await page.pdf({
        path: 'resume.pdf',
        format: 'A4',
        printBackground: true, // IMPORTANT: forces sidebar colors to render
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    console.log('PDF generated successfully as resume.pdf');
    await browser.close();
})();
```

## Step 3: Run the Script

Run the script using Node:

```bash
node export.js
```

You will now have a crisp, highly readable, and perfectly sized `resume.pdf` ready to upload to ATS systems!
