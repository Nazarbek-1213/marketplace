import base64
from io import BytesIO
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_2cbazar.db")

from PIL import Image
from fastapi.testclient import TestClient

from app.config import settings
from app.database import Base, engine
from app.main import app


class MarketplaceFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.codes: dict[str, str] = {}
        self.mail_patch = patch(
            "app.auth.send_login_code",
            side_effect=lambda email, code: self.codes.__setitem__(email, code),
        )
        self.mail_patch.start()
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)
        self.mail_patch.stop()
        Base.metadata.drop_all(bind=engine)

    def _verify_email(self, email: str, purpose: str) -> str:
        response = self.client.post(f"/api/auth/{purpose}/request-code", json={"email": email})
        self.assertEqual(response.status_code, 202, response.text)
        return self.codes[email]

    def test_seller_product_image_upload(self) -> None:
        seller_email = "images@example.com"
        seller_code = self._verify_email(seller_email, "seller")
        registration = self.client.post(
            "/api/auth/seller/register",
            json={
                "email": seller_email,
                "code": seller_code,
                "username": "image_shop",
                "password": "secure-password-123",
            },
        )
        self.assertEqual(registration.status_code, 201, registration.text)
        headers = {"Authorization": f"******"}

        headers = {"Authorization": "Bearer " + registration.json()["access_token"]}
        self.assertEqual(self.client.get("/api/auth/me", headers=headers).status_code, 200)
        png = BytesIO()
        Image.new("RGB", (4, 4), "red").save(png, format="PNG")
        image_bytes = png.getvalue()
        files = [
            ("files", ("front.png", image_bytes, "image/png")),
            ("files", ("back.png", image_bytes, "image/png")),
        ]

        with tempfile.TemporaryDirectory() as upload_dir:
            previous_upload_dir = settings.upload_dir
            settings.upload_dir = upload_dir
            try:
                self.assertEqual(
                    self.client.post("/api/seller/uploads", files=files).status_code,
                    401,
                )
                too_many_files = self.client.post(
                    "/api/seller/uploads",
                    headers=headers,
                    files=files + [("files", ("side.png", image_bytes, "image/png"))] * 2,
                )
                self.assertEqual(too_many_files.status_code, 422, too_many_files.text)
                self.assertEqual(
                    self.client.post(
                        "/api/seller/uploads",
                        headers=headers,
                        files=[("files", ("fake.png", b"not an image", "image/png"))],
                    ).status_code,
                    415,
                )
                self.assertEqual(
                    self.client.post(
                        "/api/seller/uploads",
                        headers=headers,
                        files=[("files", ("large.png", b"x" * (5 * 1024 * 1024 + 1), "image/png"))],
                    ).status_code,
                    413,
                )

                response = self.client.post(
                    "/api/seller/uploads",
                    headers=headers,
                    files=files,
                )
                self.assertEqual(response.status_code, 201, response.text)
                image_urls = response.json()["image_urls"]
                self.assertEqual(len(image_urls), 2)
                self.assertTrue(
                    all((Path(upload_dir) / url.rsplit("/", 1)[1]).is_file() for url in image_urls)
                )

                json_upload = self.client.post(
                    "/api/seller/uploads/base64",
                    headers=headers,
                    json={
                        "images": [
                            {
                                "content_type": "image/png",
                                "content_base64": base64.b64encode(image_bytes).decode("ascii"),
                            }
                        ]
                    },
                )
                self.assertEqual(json_upload.status_code, 201, json_upload.text)
                json_image_url = json_upload.json()["image_urls"][0]
                self.assertTrue(
                    (Path(upload_dir) / json_image_url.rsplit("/", 1)[1]).is_file()
                )
                invalid_base64 = self.client.post(
                    "/api/seller/uploads/base64",
                    headers=headers,
                    json={
                        "images": [
                            {"content_type": "image/png", "content_base64": "not base64!"}
                        ]
                    },
                )
                self.assertEqual(invalid_base64.status_code, 422, invalid_base64.text)

                product = self.client.post(
                    "/api/seller/products",
                    headers=headers,
                    json={
                        "name": "Ikki rasmli mahsulot",
                        "category": "Elektronika",
                        "price": "120000",
                        "stock": 1,
                        "image_urls": image_urls,
                    },
                )
                self.assertEqual(product.status_code, 201, product.text)
                self.assertEqual(product.json()["image_urls"], image_urls)
                self.assertEqual(
                    self.client.get("/api/products").json()[0]["image_urls"],
                    image_urls,
                )
            finally:
                settings.upload_dir = previous_upload_dir

    def test_seller_buyer_order_and_refresh_lifecycle(self) -> None:
        seller_email = "seller@example.com"
        seller_code = self._verify_email(seller_email, "seller")
        seller_response = self.client.post(
            "/api/auth/seller/register",
            json={
                "email": seller_email,
                "code": seller_code,
                "username": "shop_1",
                "password": "secure-password-123",
            },
        )
        self.assertEqual(seller_response.status_code, 201, seller_response.text)
        seller_tokens = seller_response.json()
        self.assertEqual(seller_tokens["access_expires_in"], 30 * 24 * 60 * 60)
        seller_headers = {"Authorization": f"Bearer {seller_tokens['access_token']}"}

        product_response = self.client.post(
            "/api/seller/products",
            headers=seller_headers,
            json={
                "name": "Simsiz quloqchin",
                "description": "Bluetooth quloqchin",
                "category": "Elektronika",
                "price": "250000",
                "stock": 4,
            },
        )
        self.assertEqual(product_response.status_code, 201, product_response.text)
        product = product_response.json()
        self.assertIsNone(product["image_url"])
        self.assertEqual(
            self.client.get("/api/categories").json(),
            ["Elektronika"],
        )

        buyer_email = "buyer@example.com"
        buyer_code = self._verify_email(buyer_email, "marketplace")
        buyer_response = self.client.post(
            "/api/auth/marketplace/verify",
            json={"email": buyer_email, "code": buyer_code},
        )
        self.assertEqual(buyer_response.status_code, 200, buyer_response.text)
        buyer_tokens = buyer_response.json()
        review_headers = {"Authorization": f"Bearer {buyer_tokens['access_token']}"}
        profile_headers = review_headers
        initial_profile = self.client.get("/api/auth/me", headers=profile_headers)
        self.assertEqual(initial_profile.status_code, 200, initial_profile.text)
        self.assertIsNone(initial_profile.json()["phone"])
        profile_response = self.client.patch(
            "/api/auth/me",
            headers=profile_headers,
            json={
                "full_name": "Ali Valiyev",
                "phone": "+998 90 123 45 67",
                "gender": "male",
                "birth_date": "1995-04-12",
            },
        )
        self.assertEqual(profile_response.status_code, 200, profile_response.text)
        self.assertEqual(profile_response.json()["full_name"], "Ali Valiyev")
        self.assertEqual(profile_response.json()["phone"], "+998 90 123 45 67")
        self.assertEqual(profile_response.json()["gender"], "male")
        self.assertEqual(profile_response.json()["birth_date"], "1995-04-12")
        self.assertEqual(
            self.client.get("/api/auth/me", headers=profile_headers).json()["full_name"],
            "Ali Valiyev",
        )
        self.assertEqual(
            self.client.patch(
                "/api/auth/me",
                headers=profile_headers,
                json={"phone": "abc"},
            ).status_code,
            422,
        )
        cleared_profile = self.client.patch(
            "/api/auth/me",
            headers=profile_headers,
            json={"phone": ""},
        )
        self.assertEqual(cleared_profile.status_code, 200, cleared_profile.text)
        self.assertIsNone(cleared_profile.json()["phone"])

        unpurchased_review = self.client.post(
            "/api/reviews",
            headers=review_headers,
            json={
                "product_id": product["id"],
                "rating": 5,
                "comment": "Hali xarid qilinmagan.",
            },
        )
        self.assertEqual(unpurchased_review.status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/reviews",
                headers=review_headers,
                json={
                    "product_id": product["id"],
                    "rating": 5,
                    "comment": "   ",
                },
            ).status_code,
            422,
        )

        order_response = self.client.post(
            "/api/orders",
            headers={"Authorization": f"Bearer {buyer_tokens['access_token']}"},
            json={
                "delivery_address": "Toshkent, Chilonzor 10-mavze, 12-uy",
                "items": [{"product_id": product["id"], "quantity": 2}],
            },
        )
        self.assertEqual(order_response.status_code, 201, order_response.text)
        self.assertEqual(order_response.json()["total"], "500000.00")

        order_history = self.client.get(
            "/api/orders",
            headers={"Authorization": f"Bearer {buyer_tokens['access_token']}"},
        )
        self.assertEqual(order_history.status_code, 200, order_history.text)
        self.assertEqual(order_history.json()[0]["items"][0]["product_name"], "Simsiz quloqchin")

        review_response = self.client.post(
            "/api/reviews",
            headers=review_headers,
            json={
                "product_id": product["id"],
                "rating": 5,
                "comment": "Juda yaxshi mahsulot, tavsiya qilaman.",
            },
        )
        self.assertEqual(review_response.status_code, 201, review_response.text)
        self.assertEqual(review_response.json()["rating"], 5)
        self.assertEqual(
            self.client.post(
                "/api/reviews",
                headers=review_headers,
                json={
                    "product_id": product["id"],
                    "rating": 4,
                    "comment": "Yana boshqa fikr.",
                },
            ).status_code,
            409,
        )
        public_reviews = self.client.get(f"/api/products/{product['id']}/reviews")
        self.assertEqual(public_reviews.status_code, 200)
        self.assertEqual(len(public_reviews.json()), 1)
        my_reviews = self.client.get("/api/reviews/mine", headers=review_headers)
        self.assertEqual(my_reviews.status_code, 200)
        self.assertEqual(len(my_reviews.json()), 1)

        for period in ("weekly", "monthly"):
            analytics_response = self.client.get(
                f"/api/seller/analytics?period={period}",
                headers=seller_headers,
            )
            self.assertEqual(analytics_response.status_code, 200, analytics_response.text)
            analytics = analytics_response.json()
            self.assertEqual(analytics["revenue"], "500000.00")
            self.assertEqual(analytics["orders"], 1)
            self.assertEqual(analytics["units_sold"], 2)
            self.assertEqual(len(analytics["daily"]), analytics["days"])
            self.assertEqual(analytics["top_products"][0]["product_id"], product["id"])
        self.assertEqual(
            self.client.get("/api/seller/analytics").status_code,
            401,
        )

        catalog_response = self.client.get("/api/products")
        self.assertEqual(catalog_response.status_code, 200)
        self.assertEqual(catalog_response.json()[0]["stock"], 2)
        self.assertEqual(catalog_response.json()[0]["average_rating"], 5)
        self.assertEqual(catalog_response.json()[0]["review_count"], 1)
        self.assertEqual(
            self.client.get("/api/categories").json(),
            ["Elektronika"],
        )

        login_response = self.client.post(
            "/api/auth/seller/login",
            json={"username": "shop_1", "password": "secure-password-123"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)

        rotated = self.client.post(
            "/api/auth/refresh",
            json={"refresh_token": seller_tokens["refresh_token"]},
        )
        self.assertEqual(rotated.status_code, 200, rotated.text)
        replay = self.client.post(
            "/api/auth/refresh",
            json={"refresh_token": seller_tokens["refresh_token"]},
        )
        self.assertEqual(replay.status_code, 401)

        malformed = self.client.get(
            "/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"}
        )
        self.assertEqual(malformed.status_code, 401)


if __name__ == "__main__":
    unittest.main()
