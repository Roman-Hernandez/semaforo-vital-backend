from dataclasses import asdict
from unittest.mock import MagicMock

from bson import ObjectId
from test_albergues import FakeAlbergueRepository, sembrar

from app.infrastructure.repositories.mongo_albergue_repository import (
    MongoAlbergueRepository,
)


def test_lists_assigned_administrator_from_users_without_copying_relationship():
    shelters = FakeAlbergueRepository()
    shelter = sembrar(shelters)
    other = sembrar(shelters, codigo="SIM-PER-002")
    db = MagicMock()
    db.__getitem__.return_value.find.return_value.sort.return_value = []
    db.usuarios.find.return_value.sort.return_value = [{
        "albergue_id": ObjectId(shelter.id), "nombre": "Juan Roman", "apellido": "Hernandez Cañas",
    }]
    repo = MongoAlbergueRepository(db)
    result = repo._with_administrators([shelter, other])
    assert result[0].administrador == "Juan Roman Hernandez Cañas"
    assert result[1].administrador is None
    query, projection = db.usuarios.find.call_args.args
    assert query["albergue_id"]["$in"] == [ObjectId(shelter.id), ObjectId(other.id)]
    assert query["role"] == "administrador_albergue"
    assert "password_hash" not in projection
    db.usuarios.find.assert_called_once()


def test_list_and_detail_both_include_assignments():
    from datetime import UTC, datetime
    db = MagicMock()
    shelter = sembrar(FakeAlbergueRepository())
    document = asdict(shelter)
    document["_id"] = ObjectId(document.pop("id"))
    document.pop("administrador")
    document["created_at"] = datetime(2026, 11, 17, tzinfo=UTC)
    db.__getitem__.return_value.find.return_value.sort.return_value = [document]
    db.__getitem__.return_value.find_one.return_value = document
    db.usuarios.find.return_value.sort.return_value = [{"albergue_id": ObjectId(shelter.id), "email": "admin@example.com"}]
    repo = MongoAlbergueRepository(db)
    assert repo.list()[0].administrador == "admin@example.com"
    assert repo.find(shelter.id).administrador == "admin@example.com"
    db.usuarios.find.return_value.sort.return_value = []
    assert repo.list()[0].administrador is None
