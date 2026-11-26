from pydantic import ConfigDict, Field

from app.models.common import TimestampModel


class TesterModel(TimestampModel):
    """Someone who tests patients' eyes, picked as "Tested by" on a sales order.

    The list is kept by the admin in Settings. Removing a name hides it from the picker
    (is_active False) but keeps it, so past orders still show who tested the patient.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    name: str
    title: str | None = None  # e.g. Optometrist
    is_active: bool = True
