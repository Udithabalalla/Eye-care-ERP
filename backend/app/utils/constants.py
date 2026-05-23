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
    # Lifecycle statuses
    CREATED = "created"
    LENS_ORDERED = "lens_ordered"
    FITTING = "fitting"
    DELIVERED = "delivered"


class PurchaseOrderStatus(str, Enum):
    DRAFT = "Draft"
    APPROVED = "Approved"
    ORDERED = "Ordered"
    RECEIVED = "Received"
    CLOSED = "Closed"

class PrescriptionType(str, Enum):
    SINGLE_VISION = "single-vision"
    BIFOCAL = "bifocal"
    PROGRESSIVE = "progressive"


class FrameMaterial(str, Enum):
    ACETATE = "acetate"
    METAL = "metal"
    TITANIUM = "titanium"
    TR90 = "tr90"
    MIXED = "mixed"
    WOOD = "wood"
    OTHER = "other"


class FrameShape(str, Enum):
    RECTANGLE = "rectangle"
    SQUARE = "square"
    ROUND = "round"
    OVAL = "oval"
    CAT_EYE = "cat-eye"
    AVIATOR = "aviator"
    GEOMETRIC = "geometric"
    OTHER = "other"


class RimType(str, Enum):
    FULL = "full"
    HALF = "half"
    RIMLESS = "rimless"


class FrameGender(str, Enum):
    MEN = "men"
    WOMEN = "women"
    UNISEX = "unisex"
    KIDS = "kids"


class FrameCategory(str, Enum):
    OPTICAL = "optical"
    SUNGLASSES = "sunglasses"
    SPORTS = "sports"
    SAFETY = "safety"
    READING = "reading"


class StockMovementType(str, Enum):
    PURCHASE_RECEIVE = "purchase_receive"
    SALE = "sale"
    ADJUSTMENT = "adjustment"
    RETURN = "return"
    DAMAGE = "damage"
    TRANSFER = "transfer"


class StockMovementRefType(str, Enum):
    GOODS_RECEIPT = "goods_receipt"
    QUICK_INTAKE = "quick_intake"
    SALES_ORDER = "sales_order"
    PURCHASE_ORDER = "purchase_order"
    ADJUSTMENT = "adjustment"
    RETURN = "return"


class GoodsReceiptStatus(str, Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"


class QuickIntakeStatus(str, Enum):
    DRAFT = "draft"
    COMMITTED = "committed"


class OpticalSalesOrderStatus(str, Enum):
    PENDING = "pending"
    FRAME_SELECTED = "frame_selected"
    LENS_ORDERED = "lens_ordered"
    IN_LAB = "in_lab"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
