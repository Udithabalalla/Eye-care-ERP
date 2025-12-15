
import asyncio
import os
import sys

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.config.database import connect_to_mongo, db
from app.repositories.doctor_repository import DoctorRepository
from app.config.settings import settings

async def main():
    print(f"Connecting to MongoDB URL: {settings.MONGODB_URL}")
    print(f"Target Database: {settings.MONGODB_DB_NAME}")
    
    await connect_to_mongo()
    
    # We might not have a DoctorRepository class exposed directly or it might handle DB differently
    # Let's import it or use raw collection if needed.
    # Looking at directory listing earlier, there is app/repositories/doctor_repository.py (implied by service)
    # But wait, I didn't verify the repository file exists, I saw the service file.
    # Let's assume the collection is "doctors" and access it directly if repo is tricky.
    
    collection = db.db.doctors
    count = await collection.count_documents({})
    print(f"\n✅ Total Doctors in DB: {count}")
    
    active_count = await collection.count_documents({"is_active": True})
    print(f"✅ Active Doctors in DB: {active_count}")

    cursor = collection.find({})
    doctors = await cursor.to_list(length=10)
    
    print("\nRecent Doctors:")
    for d in doctors:
        print(f"- {d.get('name')} (ID: {d.get('doctor_id')}, Active: {d.get('is_active')})")
        
    db.client.close()

if __name__ == "__main__":
    asyncio.run(main())
