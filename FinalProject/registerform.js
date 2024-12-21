const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { parse } = require('json2csv');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// เชื่อมต่อ MongoDB ที่ฐานข้อมูล BananasShop
mongoose.connect('mongodb://localhost:27017/BananasShop', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to BananasShop Database'))
.catch(err => console.error('MongoDB connection error:', err));
// Select the database to use.



// สร้าง Schema และ Model สำหรับผู้ใช้ภายใต้ collection Users ในฐานข้อมูล BananasShop
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// สร้าง Model โดยใช้ collection ที่ชื่อว่า Users
// กำหนดชื่อ collection ให้ชัดเจน
const User = mongoose.model('Users', userSchema, 'Users');  // parameter ที่สามคือชื่อ collection ที่ต้องการ  // ชื่อ collection ที่ใช้จะเป็น "Users"

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// ฟังก์ชันสำหรับอัปเดตไฟล์ Excel และ CSV
async function updateExportFiles(users) {
    try {
        if (users.length === 0) {
            console.log("No data to export.");
            return;
        }

        // สร้างไฟล์ Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');
        
        const columns = Object.keys(users[0]).map(key => ({ header: key, key }));
        worksheet.columns = columns;

        users.forEach(user => {
            worksheet.addRow(user);
        });

        await workbook.xlsx.writeFile('users_data.xlsx');
        console.log('Excel file updated.');

        // สร้างไฟล์ CSV
        const csvData = parse(users);
        fs.writeFileSync('users_data.csv', csvData);
        console.log('CSV file updated.');
    } catch (error) {
        console.error('Error updating export files:', error.message);
    }
}

// Route สำหรับหน้าแรก (แสดงฟอร์มสมัครสมาชิก)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Route สำหรับบันทึกข้อมูลผู้ใช้
app.post('/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;

    try {
        // Log ข้อมูลที่ได้รับ
        console.log('Received registration data:', { name, email, phone, address });

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('Email already exists:', email);
            return res.status(400).send('อีเมลนี้ถูกใช้งานแล้ว');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            address
        });

        // Log ข้อมูลก่อนบันทึก
        console.log('Attempting to save user:', {
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            address: newUser.address
        });

        const savedUser = await newUser.save();
        
        // Log ข้อมูลหลังบันทึก
        console.log('User saved successfully:', {
            id: savedUser._id,
            name: savedUser.name,
            email: savedUser.email
        });

        const users = await User.find({}, { password: 0 });
        await updateExportFiles(users);

        res.redirect('/success');
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error. Please try again later.');
    }
});

// Route สำหรับหน้าแสดงข้อความ "สมัครสมาชิกสำเร็จ"
app.get('/success', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>สมัครสมาชิกสำเร็จ</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    text-align: center;
                    padding-top: 50px;
                }
                .success-message {
                    color: #4CAF50;
                    margin-bottom: 20px;
                }
                .button {
                    padding: 10px 20px;
                    background-color: #4CAF50;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 10px;
                    display: inline-block;
                }
                .button:hover {
                    background-color: #45a049;
                }
            </style>
        </head>
        <body>
            <h1 class="success-message">สมัครสมาชิกสำเร็จ</h1>
            <p>คุณได้สมัครสมาชิกสำเร็จแล้ว</p>
            <div>
                <a href="/" class="button">กลับไปยังหน้าสมัครสมาชิก</a>
                <a href="/users" class="button">ดูรายชื่อผู้ใช้ทั้งหมด</a>
            </div>
        </body>
        </html>
    `);
});

// Route สำหรับหน้าแสดงข้อมูลผู้ใช้
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>รายชื่อผู้ใช้ทั้งหมด</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                    th { background-color: #f5f5f5; }
                    tr:hover { background-color: #f9f9f9; }
                    .header { display: flex; justify-content: space-between; align-items: center; }
                    .button { padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
                    .button:hover { background-color: #45a049; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>รายชื่อผู้ใช้ทั้งหมด</h2>
                    <a href="/" class="button">กลับหน้าหลัก</a>
                </div>
                <table>
                    <tr>
                        <th>ชื่อ</th>
                        <th>อีเมล</th>
                        <th>เบอร์โทร</th>
                        <th>ที่อยู่</th>
                        <th>วันที่สมัคร</th>
                        <th>การกระทำ</th>
                    </tr>
                    ${users.map(user => `
                        <tr>
                            <td>${user.name}</td>
                            <td>${user.email}</td>
                            <td>${user.phone || '-'}</td>
                            <td>${user.address || '-'}</td>
                            <td>${new Date(user.createdAt).toLocaleString('th-TH')}</td>
                            <td><a href="/delete/${user._id}" class="button">ลบ</a></td>
                        </tr>
                    `).join('')}
                </table>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});

// Route สำหรับลบข้อมูลผู้ใช้
app.get('/delete/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).send('User not found');
        }

        console.log('User deleted:', deletedUser);
        res.redirect('/users');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// เริ่มเซิร์ฟเวอร์
const PORT = 3000; // เปลี่ยนพอร์ตตามที่ต้องการ
app.listen(PORT, (err) => {
    if (err) {
        console.error('Error starting server:', err.message);
    } else {
        console.log(`Server is running on http://localhost:${PORT}`);
    }
});
