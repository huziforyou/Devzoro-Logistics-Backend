const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const ArabicReshaper = require('arabic-reshaper');
const BidiJS = require('bidi-js');
const bidi = BidiJS();

/**
 * Helper to handle Arabic text shaping and RTL
 */
const formatArabicText = (text) => {
  if (!text) return '';
  const str = String(text);
  
  // Comprehensive Arabic character range check
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (!arabicPattern.test(str)) return str;

  try {
    // Shape the Arabic characters with specific options for better compatibility
    const reshaped = ArabicReshaper.reshape(str, { tashkeel: 'none' });
    // Reorder for RTL display
    const bidiText = bidi.getReorderedText(reshaped);
    return bidiText;
  } catch (error) {
    console.error('Error shaping Arabic text:', error);
    return str;
  }
};

/**
 * Loads custom fonts for Arabic support
 */
const loadFonts = async (pdfDoc) => {
  try {
    const regularFontPath = path.join(__dirname, '../assets/fonts/Amiri-Regular.ttf');
    const boldFontPath = path.join(__dirname, '../assets/fonts/Amiri-Bold.ttf');
    
    const regularFontBytes = await fs.readFile(regularFontPath);
    const boldFontBytes = await fs.readFile(boldFontPath);
    
    const regularFont = await pdfDoc.embedFont(regularFontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);
    
    return { regularFont, boldFont };
  } catch (error) {
    console.error('Error loading fonts:', error);
    // Fallback to standard fonts if custom fonts fail (though Arabic will be garbled)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { regularFont, boldFont };
  }
};

/**
 * Generates a general table-based PDF report using a letterhead template.
 */
exports.generatePDFReport = async (title, columns, data) => {
  try {
    const templatePath = path.join(__dirname, '../uploads/letterhead.pdf');
    const templateBytes = await fs.readFile(templatePath);
    
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const { regularFont, boldFont } = await loadFonts(pdfDoc);

    // Title - Don't uppercase if it contains Arabic
    const formattedTitle = /[\u0600-\u06FF]/.test(title) ? title : title.toUpperCase();
    
    firstPage.drawText(formatArabicText(formattedTitle), {
      x: 50,
      y: 610,
      size: 18,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });

    let currentY = 580;
    const leftMargin = 50;
    const colWidth = (width - 100) / columns.length;

    // Draw Headers
    columns.forEach((col, i) => {
      firstPage.drawText(formatArabicText(String(col)), {
        x: leftMargin + (i * colWidth),
        y: currentY,
        size: 10,
        font: boldFont,
      });
    });

    currentY -= 20;

    // Draw Data
    data.forEach(row => {
      if (currentY < 50) return;
      row.forEach((cell, i) => {
        firstPage.drawText(formatArabicText(String(cell || 'N/A')), {
          x: leftMargin + (i * colWidth),
          y: currentY,
          size: 9,
          font: regularFont,
        });
      });
      currentY -= 15;
    });

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generating server-side PDF report:', error);
    throw error;
  }
};

/**
 * Generates a Dispatch Order PDF using a letterhead template.
 */
exports.generateDispatchOrderPDF = async (order, req) => {
  try {
    const templatePath = path.join(__dirname, '../uploads/letterhead.pdf');
    const templateBytes = await fs.readFile(templatePath);
    
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const { regularFont, boldFont } = await loadFonts(pdfDoc);

    const fontSize = 12;
    let currentY = 580;
    const leftMargin = 50;
    const lineSpacing = 25;

    const drawField = (label, value) => {
      firstPage.drawText(formatArabicText(label), {
        x: leftMargin,
        y: currentY,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      firstPage.drawText(formatArabicText(String(value || 'N/A')), {
        x: leftMargin + 150,
        y: currentY,
        size: fontSize,
        font: regularFont,
        color: rgb(0, 0, 0),
      });

      currentY -= lineSpacing;
    };

    // Title
    firstPage.drawText(formatArabicText('DISPATCH ORDER'), {
      x: width / 2 - 60,
      y: 610,
      size: 18,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });

    const fields = [
      ['Order ID (DN):', order.deliveryNoteNumber || 'N/A'],
      ['Date:', order.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()],
      ['Driver Name:', order.assignedDriver?.fullName || order.assignedDriver?.name || 'N/A'],
      ['Vehicle Number:', order.assignedVehicle?.plateNumber || order.vehiclePlateNumber || 'N/A'],
      ['Loading Point:', order.loadingFrom || 'N/A'],
      ['Unloading Point:', order.offloadingTo || 'N/A'],
      ['Client Name:', order.customerName || 'N/A'],
      ['Material:', order.materialDescription || 'N/A'],
      ['Quantity:', order.materialQuantity || '0'],
      ['Status:', order.status || 'N/A'],
    ];

    if (order.trackingId) {
      fields.push(['Actual Distance:', `${(order.actualDistance || 0).toFixed(2)} km`]);
    }

    if (order.outForDeliveryTime) {
      fields.push(['Out for Delivery:', new Date(order.outForDeliveryTime).toLocaleString()]);
    }

    if (order.status === 'Delivered') {
      fields.push(['Received Qty:', order.receivedQuantity || '0']);
      fields.push(['Qty Status:', `${order.quantityStatus || 'N/A'} (Diff: ${order.quantityDifference || '0'})`]);
      fields.push(['Delivered At:', `${order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString() : 'N/A'} ${order.deliveredTime || ''}`]);
      fields.push(['Notes:', order.deliveryNotes || 'No notes']);
      
      if (order.startTrackingLocation?.lat && order.endTrackingLocation?.lat) {
        fields.push(['Start Coords:', `${order.startTrackingLocation.lat.toFixed(4)}, ${order.startTrackingLocation.lng.toFixed(4)}`]);
        fields.push(['End Coords:', `${order.endTrackingLocation.lat.toFixed(4)}, ${order.endTrackingLocation.lng.toFixed(4)}`]);
      }
    }

    fields.forEach(([label, value]) => drawField(label, value));

    // QR Code Generation & Embedding
    if (order.trackingId) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || `https://${req?.get('host') || 'dispatch-portal.com'}`;
        const trackingUrl = `${frontendUrl}/track/${order.trackingId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
          margin: 1,
          width: 200,
          color: {
            dark: '#003366',
            light: '#FFFFFF'
          }
        });
        
        const qrImageBytes = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
        const qrImage = await pdfDoc.embedPng(qrImageBytes);
        
        firstPage.drawImage(qrImage, {
          x: width - 150,
          y: 480,
          width: 100,
          height: 100,
        });

        firstPage.drawText(formatArabicText('SCAN TO TRACK LIVE'), {
          x: width - 150,
          y: 470,
          size: 8,
          font: boldFont,
          color: rgb(0, 0.2, 0.4),
        });
      } catch (qrError) {
        console.error('Error embedding QR code in PDF:', qrError);
      }
    }

    // Image embedding logic...
    if (order.deliveryNoteData && order.deliveryNoteType && order.deliveryNoteType.startsWith('image/')) {
      try {
        const imageBytes = Buffer.from(order.deliveryNoteData, 'base64');
        let image;
        if (order.deliveryNoteType === 'image/jpeg' || order.deliveryNoteType === 'image/jpg') {
          image = await pdfDoc.embedJpg(imageBytes);
        } else if (order.deliveryNoteType === 'image/png') {
          image = await pdfDoc.embedPng(imageBytes);
        }

        if (image) {
          const newPage = pdfDoc.addPage([width, height]);
          newPage.drawText(formatArabicText('ATTACHED DELIVERY NOTE'), {
            x: 50,
            y: 650,
            size: 18,
            font: boldFont,
            color: rgb(0, 0.2, 0.4),
          });

          const dims = image.scale(1);
          const maxWidth = width - 100;
          const maxHeight = 500;
          const scale = Math.min(maxWidth / dims.width, maxHeight / dims.height);

          newPage.drawImage(image, {
            x: 50,
            y: 600 - (dims.height * scale),
            width: dims.width * scale,
            height: dims.height * scale,
          });
        }
      } catch (imgError) {
        console.error('Error embedding image in server PDF:', imgError);
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generating server-side PDF:', error);
    throw error;
  }
};
