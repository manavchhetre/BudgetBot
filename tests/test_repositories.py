from bson import ObjectId

from app.repositories import serialize_id


def test_serialize_id_converts_nested_object_ids():
    user_id = ObjectId()
    conversation_id = ObjectId()
    document = {
        "_id": ObjectId(),
        "user_id": user_id,
        "conversation_id": conversation_id,
        "nested": {"owner_id": user_id},
    }

    serialized = serialize_id(document)

    assert isinstance(serialized["id"], str)
    assert serialized["user_id"] == str(user_id)
    assert serialized["conversation_id"] == str(conversation_id)
    assert serialized["nested"]["owner_id"] == str(user_id)
