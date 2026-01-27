import bcrypt from "bcrypt";

async function run() {
  const adminHash = await bcrypt.hash("admin123", 10);
  console.log("ADMIN:", adminHash);

  const viewerHash = await bcrypt.hash("viewer123", 10);
  console.log("VIEWER:", viewerHash);
}

run();
