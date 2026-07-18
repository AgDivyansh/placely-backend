import "dotenv/config";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import { College } from "../models/College";
import { User } from "../models/User";
import { Company } from "../models/Company";
import { Job } from "../models/Job";
import { Application } from "../models/Application";
import { Alumni } from "../models/Alumni";
import { Announcement, DocumentModel, Notification } from "../models/misc";
import { STAGES, BRANCHES } from "../types";

/**
 * Seed script — wipes and repopulates the database with realistic demo
 * data so the app is immediately usable after setup.
 *
 * Run with:  npm run seed
 *
 * Demo logins after seeding:
 *   Student → email: divyansh@gmail.com   password: placely2026
 *   Admin   → email: divyansh@admin.com   password: placely2026
 */

const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

async function seed() {
  await connectDB();
  console.log("🌱 Seeding database...");

  // Clear everything (demo only — never do this in production).
  await Promise.all([
    College.deleteMany({}), User.deleteMany({}), Company.deleteMany({}),
    Job.deleteMany({}), Application.deleteMany({}), Alumni.deleteMany({}),
    Announcement.deleteMany({}), DocumentModel.deleteMany({}), Notification.deleteMany({}),
  ]);

  // --- College ---
  const college = await College.create({
    name: "G.L. Bajaj Institute of Technology",
    slug: "glbajaj",
    city: "Greater Noida",
  });

  // --- Admin + demo student ---
  const admin = await User.create({
    collegeId: college._id,
    role: "admin",
    name: "Placement Officer",
    email: "divyansh@admin.com",
    password: "placely2026",
  });

  const demoStudent = await User.create({
    collegeId: college._id,
    role: "student",
    name: "Divyansh Agarwal",
    email: "divyansh@gmail.com",
    phone: "+919027395702",
    collegeRollId: "21CS1001",
    password: "placely2026",
    branch: "CSE",
    cgpa: 8.4,
    tenthPercent: 89,
    twelfthPercent: 84,
    backlogs: 0,
    skills: ["React", "JavaScript", "Node.js", "TypeScript"],
  });

  // --- More students (for the directory + applicants) ---
  const firstNames = ["Aarav", "Diya", "Ishaan", "Riya", "Krishna", "Ananya", "Arjun", "Sneha", "Vihaan", "Saanvi", "Aditya", "Kavya", "Karan", "Aanya", "Shaurya", "Tara", "Veer", "Aisha", "Yash", "Ira"];
  const lastNames = ["Mehta", "Krishnan", "Patel", "Sharma", "Iyer", "Desai", "Reddy", "Banerjee", "Kapoor", "Joshi"];

  const students = [demoStudent];
  for (let i = 0; i < 40; i++) {
    const name = `${rand(firstNames)} ${rand(lastNames)}`;
    const branch = rand(BRANCHES as unknown as string[]);
    const s = await User.create({
      collegeId: college._id,
      role: "student",
      name,
      email: `student${i}@college.edu`,
      phone: `+9190000${String(10000 + i).slice(-5)}`,
      collegeRollId: `21${branch.slice(0, 2).toUpperCase()}${1100 + i}`,
      password: "placely2026",
      branch,
      cgpa: +(6.5 + Math.random() * 3.5).toFixed(1),
      tenthPercent: randInt(70, 95),
      twelfthPercent: randInt(65, 95),
      backlogs: Math.random() > 0.8 ? randInt(1, 2) : 0,
    });
    students.push(s);
  }

  // --- Companies ---
  const companyData = [
    { name: "Stripe", initial: "S", color: "#635BFF", industry: "Fintech", rating: 4.8, avgPackage: 32, difficulty: "Hard" },
    { name: "Razorpay", initial: "R", color: "#02BCE9", industry: "Fintech", rating: 4.6, avgPackage: 18, difficulty: "Medium" },
    { name: "Zomato", initial: "Z", color: "#E23744", industry: "E-commerce", rating: 4.2, avgPackage: 14, difficulty: "Medium" },
    { name: "Atlassian", initial: "A", color: "#0052CC", industry: "Software", rating: 4.7, avgPackage: 26, difficulty: "Hard" },
    { name: "Postman", initial: "P", color: "#FF6C37", industry: "Software", rating: 4.5, avgPackage: 22, difficulty: "Medium" },
    { name: "Swiggy", initial: "Sw", color: "#FC8019", industry: "E-commerce", rating: 4.3, avgPackage: 16, difficulty: "Medium" },
    { name: "Goldman Sachs", initial: "G", color: "#7399C6", industry: "Banking", rating: 4.6, avgPackage: 36, difficulty: "Hard" },
    { name: "Microsoft", initial: "M", color: "#0078D4", industry: "Software", rating: 4.8, avgPackage: 44, difficulty: "Hard" },
  ];
  const companies = await Company.insertMany(
    companyData.map((c) => ({
      ...c,
      collegeId: college._id,
      packageTrend: [c.avgPackage - 4, c.avgPackage - 2, c.avgPackage - 1, c.avgPackage],
    }))
  );

  // --- Jobs ---
  const roles = ["SDE Intern", "Software Engineer", "Frontend Engineer", "Backend Engineer", "Full-stack Developer", "Data Analyst"];
  const jobs = [];
  for (let i = 0; i < 8; i++) {
    const company = companies[i % companies.length];
    const job = await Job.create({
      collegeId: college._id,
      companyId: company._id,
      role: rand(roles),
      package: company.avgPackage,
      location: rand(["Bengaluru", "Remote", "Hyderabad", "Gurgaon", "Pune"]),
      type: "Full-time",
      description: "Work with a talented team building products used by millions. Strong fundamentals in DSA and system design expected.",
      rounds: ["Online Assessment", "Technical Round 1", "Technical Round 2", "HR Round"],
      eligibility: {
        minCgpa: rand([6.5, 7, 7.5, 8]),
        minTenth: 60,
        minTwelfth: 60,
        branches: Math.random() > 0.5 ? ["CSE", "IT", "AIML"] : [],
        maxBacklogs: 0,
      },
      deadline: new Date(Date.now() + randInt(3, 30) * 86400000),
    });
    jobs.push(job);
  }

  // --- Applications (spread students across jobs and stages) ---
  for (const job of jobs) {
    const applicantPool = students.slice(0, randInt(6, 15));
    for (const student of applicantPool) {
      const stage = rand(STAGES as unknown as string[]);
      try {
        await Application.create({
          collegeId: college._id,
          jobId: job._id,
          companyId: job.companyId,
          studentId: student._id,
          currentStage: stage,
          stageHistory: [{ stage: "applied", at: new Date() }],
        });
      } catch {
        // duplicate (same student+job) — skip
      }
    }
  }

  // --- Alumni ---
  await Alumni.insertMany([
    { collegeId: college._id, name: "Aditya Sharma", gradYear: 2023, company: "Stripe", role: "SWE", domains: ["System Design", "Fintech"] },
    { collegeId: college._id, name: "Priya Menon", gradYear: 2021, company: "Razorpay", role: "Senior SWE", domains: ["Payments", "Backend"] },
    { collegeId: college._id, name: "Rohan Khanna", gradYear: 2023, company: "Goldman Sachs", role: "Analyst", domains: ["DSA", "Quant"] },
    { collegeId: college._id, name: "Karthik Iyer", gradYear: 2022, company: "Microsoft", role: "SDE II", domains: ["OOP", "Azure"] },
  ]);

  // --- Announcements ---
  await Announcement.insertMany([
    { collegeId: college._id, title: "Razorpay drive — pre-placement talk Monday", body: "All shortlisted students must attend the pre-placement talk Monday 10 AM.", category: "drive", pinned: true, authorId: admin._id, authorName: "Placement Cell" },
    { collegeId: college._id, title: "Resume deadline extended to Friday", body: "Upload your final resume to the document vault by Friday 6 PM.", category: "deadline", pinned: true, authorId: admin._id, authorName: "Placement Cell" },
    { collegeId: college._id, title: "Mock interviews with alumni — register now", body: "Limited slots for mock interviews with verified alumni.", category: "event", pinned: false, authorId: admin._id, authorName: "Placement Cell" },
  ]);

  // --- Documents for the demo student ---
  const docTypes = [
    { type: "resume", name: "Resume", required: true, status: "verified" },
    { type: "tenth", name: "10th marksheet", required: true, status: "verified" },
    { type: "twelfth", name: "12th marksheet", required: true, status: "uploaded" },
    { type: "transcript", name: "College transcript", required: true, status: "missing" },
    { type: "id_card", name: "College ID card", required: true, status: "verified" },
    { type: "noc", name: "No-objection certificate", required: false, status: "missing" },
  ];
  await DocumentModel.insertMany(
    docTypes.map((d) => ({
      ...d,
      collegeId: college._id,
      studentId: demoStudent._id,
      filename: d.status !== "missing" ? `${d.type}.pdf` : undefined,
      uploadedAt: d.status !== "missing" ? new Date() : undefined,
    }))
  );

  // --- A few notifications for the demo student ---
  await Notification.insertMany([
    { collegeId: college._id, userId: demoStudent._id, title: "New job matching your profile", body: "Microsoft posted a Software Engineer role.", kind: "job", read: false },
    { collegeId: college._id, userId: demoStudent._id, title: "Application update", body: "You've been shortlisted at Razorpay.", kind: "stage", read: false },
  ]);

  console.log("✅ Seed complete!");
  console.log("   Student login: divyansh@gmail.com / placely2026");
  console.log("   Admin login:   divyansh@admin.com / placely2026");

  await disconnectDB();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.connection.close();
  process.exit(1);
});
