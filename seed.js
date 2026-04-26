// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const User = require('./models/User');

// dotenv.config();

// const seedAdmin = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log('MongoDB Connected for seeding...');

//     // Clear ALL users to ensure a clean state
//     await User.deleteMany({});
//     console.log('All users cleared from database');

//     const admin = await User.create({
//       name: 'System Admin',
//       email: 'admin@portal.com',
//       password: 'admin1234',
//       role: 'admin',
//     });

//     console.log('Admin user created successfully:');
//     console.log('Email: admin@portal.com');
//     console.log('Password: admin1234');

//     process.exit();
//   } catch (error) {
//     console.error('Error seeding admin:', error.message);
//     process.exit(1);
//   }
// };

// seedAdmin();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding...');

    // 1. Clear existing users
    await User.deleteMany({});
    console.log('Database cleared.');

    // 2. Create Admin User
    // Note: Agar aapne model mein bcrypt lagaya hai, to ye password khud hash ho jayega
    const admin = await User.create({
      name: 'Devzoro Admin',
      email: 'devzoro@demo.com',
      password: 'devzoro1', // Ye password login ke liye use hoga
      role: 'admin',
    });

    console.log('---------------------------------');
    console.log('✅ Admin user created successfully!');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Password: devzoro1`);
    console.log('---------------------------------');

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();