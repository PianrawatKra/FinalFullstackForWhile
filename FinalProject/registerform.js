const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { parse } = require('json2csv');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

// เชื่อมต่อ MongoDB
mongoose.connect('mongodb://localhost:27017/BananasShop', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to BananasShop Database'))
.catch(err => console.error('MongoDB connection error:', err));

// สร้าง Schema และ Model สำหรับ Users
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('Users', userSchema, 'Users');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// ตั้งค่า express-session
app.use(session({
    secret: 'your-secret-key', // เปลี่ยนเป็น secret key ที่ปลอดภัย
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // ใช้ true หากใช้ HTTPS
}));

// ฟังก์ชันสำหรับอัปเดตไฟล์ Excel และ CSV
async function updateExportFiles(users) {
    try {
        if (users.length === 0) {
            console.log("No data to export.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');
        
        const columns = Object.keys(users[0]).map(key => ({ header: key, key }));
        worksheet.columns = columns;

        users.forEach(user => {
            worksheet.addRow(user);
        });

        await workbook.xlsx.writeFile('users_data.xlsx');
        console.log('Excel file updated.');

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
        const existingUser = await User.findOne({ email });
        if (existingUser) {
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

        const savedUser = await newUser.save();

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
        </head>
        <body>
            <h1>สมัครสมาชิกสำเร็จ</h1>
            <a href="/login">เข้าสู่ระบบ</a>
        </body>
        </html>
    `);
});

// Route สำหรับหน้าเข้าสู่ระบบ
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>เข้าสู่ระบบ</title>
        </head>
        <body>
            <h1>เข้าสู่ระบบ</h1>
            <form method="POST" action="/login">
                <label>อีเมล:</label>
                <input type="email" name="email" required>
                <br>
                <label>รหัสผ่าน:</label>
                <input type="password" name="password" required>
                <br>
                <button type="submit">เข้าสู่ระบบ</button>
            </form>
        </body>
        </html>
    `);
});

// Route สำหรับตรวจสอบการเข้าสู่ระบบ
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).send('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }

        // เก็บ userId ใน session
        req.session.userId = user._id;
        res.redirect('/profile');
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route สำหรับหน้าโปรไฟล์
app.get('/profile', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(req.session.userId, { password: 0 });
        if (!user) {
            return res.status(404).send('ไม่พบผู้ใช้');
        }

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>โปรไฟล์</title>
            </head>
            <body>
                <h1>โปรไฟล์ของคุณ</h1>
                <p><strong>ชื่อ:</strong> ${user.name}</p>
                <p><strong>อีเมล:</strong> ${user.email}</p>
                <p><strong>เบอร์โทร:</strong> ${user.phone || '-'}</p>
                <p><strong>ที่อยู่:</strong> ${user.address || '-'}</p>
                <a href="/logout">ออกจากระบบ</a>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route สำหรับออกจากระบบ
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/login');
    });
});

// เริ่มเซิร์ฟเวอร์
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
