"""Reset database - drop all collections and re-seed"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.settings import settings

async def reset_database():
    """Drop all collections in the database"""
    print("⚠️  WARNING: This will delete ALL data in the database!")
    confirmation = input("Type 'YES' to confirm: ")
    
    if confirmation != "YES":
        print("❌ Operation cancelled")
        return
    
    print("\n🗑️  Resetting database...")
    print("="*60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    try:
        # Get all collection names
        collections = await db.list_collection_names()
        
        # Drop each collection
        for collection in collections:
            await db[collection].drop()
            print(f"  ✅ Dropped collection: {collection}")
        
        print("\n" + "="*60)
        print("✅ Database reset completed!")
        print("\nNow run: python scripts/seed_data.py")
        
    except Exception as e:
        print(f"\n❌ Error resetting database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(reset_database())
