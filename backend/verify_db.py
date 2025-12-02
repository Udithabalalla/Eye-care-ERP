import asyncio
import os
import sys

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.config.database import connect_to_mongo, db
from app.repositories.product_repository import ProductRepository
from app.config.settings import settings

async def main():
    print(f"Connecting to MongoDB URL: {settings.MONGODB_URL}")
    print(f"Target Database: {settings.MONGODB_DB_NAME}")
    
    await connect_to_mongo()
    
    repo = ProductRepository(db.db)
    count = await repo.count()
    
    print(f"\n✅ Total Products in DB: {count}")
    
    # List first 5 products to verify content
    products, _ = await repo.list_products(limit=5)
    print("\nRecent Products:")
    for p in products:
        print(f"- {p.name} (SKU: {p.sku}, ID: {p.product_id})")
        
    await db.client.close()

if __name__ == "__main__":
    asyncio.run(main())
