from enum import Enum

class DoctorSpecialization(str, Enum):
    OPHTHALMOLOGIST = "Ophthalmologist"
    OPTOMETRIST = "Optometrist"
    OPTICIAN = "Optician"
    SURGEON = "Surgeon"
    CONSULTANT = "Consultant"
    OTHER = "Other"
