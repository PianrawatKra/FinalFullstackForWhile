const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { parse } = require('json2csv');
const path = require('path');

const app = express();

// เสิร์ฟ Static Files
app.use(express.static(path.join(__dirname, 'public')));

// ตั้งค่า MongoDB
mongoose.connect('mongodb://localhost:27017/mydatabase', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    socketTimeoutMS: 30000, // เพิ่ม Timeout
    connectTimeoutMS: 30000 // เพิ่ม Timeout
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// สร้าง Schema และ Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String }
});
const User = mongoose.model('User', userSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// ฟังก์ชันสำหรับอัปเดตไฟล์ Excel และ CSV
async function updateExportFiles() {
    try {
        const users = await User.find();
        if (users.length === 0) {
            console.log("No data to export.");
            return;
        }

        // สร้างไฟล์ Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');

        const columns = Object.keys(users[0].toObject()).map(key => ({ header: key, key }));
        worksheet.columns = columns;

        for (const user of users) {
            worksheet.addRow(user.toObject());
        }

        await workbook.xlsx.writeFile('users_data.xlsx');
        console.log('Excel file updated.');

        // สร้างไฟล์ CSV
        const csvData = parse(users.map(user => user.toObject()));
        fs.writeFileSync('users_data.csv', csvData);
        console.log('CSV file updated.');
    } catch (error) {
        console.error('Error updating export files:', error.message);
    }
}

// Route สำหรับ Home Page
app.get('/', (req, res) => {
    res.send('Welcome to the Home Page!');
});

// เส้นทางสำหรับฟอร์มสมัครสมาชิก
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// เส้นทางสำหรับบันทึกข้อมูลผู้ใช้
app.post('/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;

    try {
        // ตรวจสอบว่ามีอีเมลนี้ในระบบหรือไม่
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.error('Email already registered:', email);
            return res.status(400).send('Email already registered.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // บันทึกข้อมูลผู้ใช้ใน MongoDB
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            address
        });
        await newUser.save();
        console.log('User registered:', newUser);

        // อัปเดตไฟล์ Excel และ CSV
        await updateExportFiles();

        res.status(200).send('Registration successful.');
    } catch (error) {
        console.error('Error during registration:', error.message);
        res.status(500).send('Internal Server Error. Please try again later.');
    }
});

// เริ่มเซิร์ฟเวอร์
const PORT = 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// เพิ่ม Timeout 30 วินาที
server.timeout = 60000;
