import { NextResponse } from "next/server";

export async function GET() {
  // Add your API logic here
  return NextResponse.json({ message: "Users API endpoint" });
}
