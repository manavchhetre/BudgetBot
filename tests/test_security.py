from app.security import hash_password, verify_password


def test_hash_password_verifies_and_does_not_store_plaintext():
    password_hash = hash_password("correct horse battery staple")

    assert password_hash != "correct horse battery staple"
    assert verify_password("correct horse battery staple", password_hash)
    assert not verify_password("wrong password", password_hash)
