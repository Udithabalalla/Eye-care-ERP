from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    OPTOMETRIST = "optometrist"
    STAFF = "staff"
    RECEPTIONIST = "receptionist"

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no-show"

class AppointmentType(str, Enum):
    CONSULTATION = "consultation"
    FOLLOW_UP = "follow-up"
    EMERGENCY = "emergency"
    SCREENING = "screening"

class PaymentStatus(str, Enum):
    PAID = "paid"
    PARTIAL = "partial"
    PENDING = "pending"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    NETBANKING = "netbanking"
    INSURANCE = "insurance"
    BANK_TRANSFER = "bank-transfer"

class ProductCategory(str, Enum):
    CONTACT_LENSES = "contact-lenses"
    EYEGLASSES = "eyeglasses"
    FRAMES = "frames"
    SUNGLASSES = "sunglasses"
    EYE_DROPS = "eye-drops"
    ACCESSORIES = "accessories"

class TransactionType(str, Enum):
    PURCHASE = "purchase"
    SALE = "sale"
    ADJUSTMENT = "adjustment"
    RETURN = "return"
    DAMAGED = "damaged"


class LedgerTransactionType(str, Enum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    SUPPLIER_PAYMENT = "SUPPLIER_PAYMENT"
    CUSTOMER_PAYMENT = "CUSTOMER_PAYMENT"
    REFUND = "REFUND"


class LedgerReferenceType(str, Enum):
    INVOICE = "INVOICE"
    SALES_ORDER = "SALES_ORDER"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    SUPPLIER_INVOICE = "SUPPLIER_INVOICE"
    STOCK_ADJUSTMENT = "STOCK_ADJUSTMENT"


class InventoryMovementType(str, Enum):
    PURCHASE_IN = "PURCHASE_IN"
    SALE_OUT = "SALE_OUT"
    ADJUSTMENT = "ADJUSTMENT"
    RETURN = "RETURN"


class SalesOrderStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    IN_PRODUCTION = "in_production"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PrescriptionType(str, Enum):
    SINGLE_VISION = "single-vision"
    BIFOCAL = "bifocal"
    PROGRESSIVE = "progressive"
