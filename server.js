const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify email configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to take our messages');
  }
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
  const {
    fullName,
    email,
    phone,
    contactMethod,
    plan,
    description,
    deadline,
    terms,
  } = req.body;

  try {
    // Store in database
    const result = await pool.query(
      `INSERT INTO contact_submissions 
      (full_name, email, phone, contact_method, plan, project_description, deadline, terms) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [fullName, email, phone, contactMethod, plan, description, deadline, terms]
    );

    console.log('Data saved to database:', result.rows[0]);

    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'New Contact Form Submission',
      html: `
        <h2>New Project Request</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Preferred Contact:</strong> ${contactMethod}</p>
        <p><strong>Selected Plan:</strong> ${plan}</p>
        <p><strong>Project Description:</strong> ${description}</p>
        <p><strong>Deadline:</strong> ${deadline}</p>
      `,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.response);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Still return success if database save worked
      return res.json({ 
        success: true, 
        message: 'Form submitted successfully but email notification failed',
        emailError: emailError.message
      });
    }

    res.json({ 
      success: true, 
      message: 'Form submitted successfully' 
    });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while submitting the form',
      error: error.message
    });
  }
});

// Test endpoint for email
app.get('/test-email', async (req, res) => {
  try {
    const testMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'Test Email',
      html: '<h1>This is a test email</h1><p>If you receive this, the email configuration is working.</p>'
    };
    
    const info = await transporter.sendMail(testMailOptions);
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      info: info.response
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

// Test endpoint for database
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});