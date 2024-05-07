const express = require('express');
const bodyparser = require('body-parser');
const multer = require('multer');
const Tesseract = require('tesseract.js');
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const { PDFDocument, rgb } = require('pdf-lib');

const fs  = require('fs').promises;

const path = require('path');

const app = express();
app.use(cors());
const PORT = process.env.PORT;
const mongodbstring = process.env.MONGO_URL;

// connect mongoose.
mongoose.connect(mongodbstring, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

const User = require('./schemas/user-data');

function authenticateToken(req, res, next) {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing token' });
    }
  
    jwt.verify(token, secretKey, (err, decodedToken) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Forbidden: Invalid token' });
      }
      req.userId = decodedToken.userId; // Attach userId to request object
      next();
    });
  }

// Set up multer for file uploads

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads'); // Save uploaded files to the 'uploads' directory
    },
    filename: function (req, file, cb) {
      // Rename files to avoid conflicts and maintain file extensions
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  });
const upload = multer({ storage: storage });

// Serve static files from the 'public' directory
app.use('/uploads',express.static('uploads'));
app.use('/templates',express.static('templates'));
app.use('/filled_invoices',express.static('filled_invoices'));


app.use(bodyparser.json());
app.use(express.urlencoded({extended:true}));

const templatepath = 'templates/GST_Invoice.pdf';

app.get('/',(req,res) =>{
    res.json({message:"api working at port 80 everything is fine!",
    lines:"hello"});
})



app.post('/auth/user/signup', async (req, res) => {
    const { username,email, password } = req.body;
  
    try {
      // Check if the user already exists
      const existingUser = await User.findOne({ email: email });
      if (existingUser) {
        return res.status(400).json({ error: 'User with email already exists' });
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10); // 10 is the saltRounds parameter
  
      // Create a new user with hashed password
      const newUser = new User({
        username: username,
        email: email,
        password: hashedPassword,
      });
  
      // Save the new user to the database
      const savedUser = await newUser.save();
  
      // Return success response
      res.status(200).json({ success: true, user: savedUser });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
   
  });
  
  
  
  app.post('/auth/user/login',authenticateToken, async (req, res) => {
    const { email, password } = req.body;
    try {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
      // Compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
      // Generate JWT token with no expiration time
      const token = jwt.sign({ email: user.email, userId: user._id }, secretKey);
  
      // Create a response object with user details and token
      const responseData = {
        success: true,
        message: 'Login successful',
        userId: user._id,
        token,
        // Include additional user details here
        userDetails: {
          username: user.username,
          email: user.email,
          
          // Add more user details as needed
        }
      };
  
      res.json(responseData);
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });


// Handle file upload
app.post('/upload', upload.single('bill'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const result = await Tesseract.recognize(req.file.path, 'eng', {
            logger: m => console.log(m) // Enable logger to see potential errors
        });

        console.log('Extracted text:', result.data.text);

        // Here you can parse the extracted text and extract the necessary information
        // Then send back the extracted information as a response
        res.send('Text extracted from the bill: ' + result.data.text);
    } catch (error) {
        console.error('Error during OCR:', error);
        res.status(500).send('Error during OCR: ' + error.message);
    }
});
app.post('/create-invoice', async (req, res) => {
    const { wsaddress, wsgsstin, wspanno, rname, rbname, raddress, rgstin, invoiceDetails } = req.body;

    // Load the PDF template
    const templateBytes = await fs.readFile(templatepath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Get the first page of the template
    const firstPage = pdfDoc.getPages()[0];
    const { width, height } = firstPage.getSize();
    const fontSize = 12;
    const textOptions = { size: fontSize, color: rgb(0, 0, 0) };

    // Define positions for adding text
    const positions = {
        wsaddress: { x: 190, y: height - 112 },
        wsgsstin: { x: 190, y: height - 127 },
        wspanno: { x: 190, y: height - 138 },
        rname: { x: 140, y: height - 210 },
        rbname: { x: 140, y: height - 225 },
        raddress: { x: 90, y: height - 244 },
        rgstin: { x: 90, y: height - 258 },
        // Add more positions for other details as needed
    };

    // Add text to the PDF at specified positions for general details
    const font = await pdfDoc.embedFont('Helvetica');
    for (const [key, position] of Object.entries(positions)) {
        const value = req.body[key];
        if (value) {
            firstPage.drawText(value, {
                x: position.x,
                y: position.y,
                size: fontSize,
                font: font,
                color: textOptions.color,
            });
        }
    }

    // Define positions for adding text for invoice details
    const invoiceDetailsStartPosition = { x: 40, y: height - 340 }; // Start position for invoice details
    const lineHeight = 20; // Line height for each detail

    // Add text to the PDF for each item in the invoiceDetails list
    invoiceDetails.forEach((detail, index) => {
        const startY = invoiceDetailsStartPosition.y - index * lineHeight;
        let currentX = invoiceDetailsStartPosition.x;
    
        Object.entries(detail).forEach(([key, value]) => {
            let xPos;
            if (key === 'description') {
                // Set a fixed width for the description field
                xPos = currentX;
                currentX += 270; // Fixed width for description field
            }
             else {
                // Calculate the width of the text based on its content
                const textWidth = font.widthOfTextAtSize(value.toString(), fontSize);
    
                // Calculate the x-position of other fields based on their content width
                xPos = currentX;
                currentX += textWidth + 50; // Add extra padding between fields
            }
    
            // Draw the text at the calculated position
            firstPage.drawText(` ${value}`, {
                x: xPos,
                y: startY,
                size: fontSize,
                font: font,
                color: textOptions.color,
            });
        });
    });

    // Save the filled invoice
    const filledInvoicePath = `filled_invoices/${rname}_Invoice.pdf`;
    const filledInvoiceBytes = await pdfDoc.save();
    await fs.writeFile(filledInvoicePath, filledInvoiceBytes);

    // Send the filled invoice as a download
    res.download(filledInvoicePath, 'Filled_Invoice.pdf', (err) => {
        if (err) {
            console.error('Error sending filled invoice:', err);
            res.status(500).send('Error sending filled invoice');
        } else {
            console.log('Filled invoice sent successfully.');
        }
    });
});





// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
