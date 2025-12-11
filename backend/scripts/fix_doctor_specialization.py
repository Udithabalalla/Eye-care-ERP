import asyncio
import os
import sys

# Add the parent directory to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config.database import connect_to_mongo, close_mongo_connection, get_database
from app.utils.doctor_constants import DoctorSpecialization

async def fix_specializations():
    print("Connecting to database...")
    await connect_to_mongo()
    db = get_database()
    collection = db.doctors
    
    print("Checking for invalid specializations...")
    
    # Map of common misspellings or invalid values to valid ones
    corrections = {
        "Opthalamogist": DoctorSpecialization.OPHTHALMOLOGIST.value,
        "opthalamogist": DoctorSpecialization.OPHTHALMOLOGIST.value,
        "ophthalmologist": DoctorSpecialization.OPHTHALMOLOGIST.value,
        "optometrist": DoctorSpecialization.OPTOMETRIST.value,
        "optician": DoctorSpecialization.OPTICIAN.value,
        "surgeon": DoctorSpecialization.SURGEON.value,
        "consultant": DoctorSpecialization.CONSULTANT.value,
        "other": DoctorSpecialization.OTHER.value
    }
    
    valid_values = [e.value for e in DoctorSpecialization]
    
    cursor = collection.find({})
    count = 0
    updated = 0
    
    async for doc in cursor:
        count += 1
        current_spec = doc.get("specialization")
        
        if current_spec not in valid_values:
            print(f"Found invalid specialization: '{current_spec}' for doctor {doc.get('name')} ({doc.get('doctor_id')})")
            
            new_spec = corrections.get(current_spec) or corrections.get(current_spec.lower())
            
            if new_spec:
                print(f"  -> Correcting to '{new_spec}'")
                await collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"specialization": new_spec}}
                )
                updated += 1
            else:
                print(f"  -> No automatic correction found. Setting to 'Other'")
                await collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"specialization": DoctorSpecialization.OTHER.value}}
                )
                updated += 1
    
    print(f"\nScanned {count} doctors.")
    print(f"Updated {updated} records.")
    
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(fix_specializations())
