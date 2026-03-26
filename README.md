# MERN E-Commerce Store (Microservices Architecture)

Dự án này là hệ thống E-Commerce được refactor từ kiến trúc Monolithic (MERN) sang Microservices Architecture.

## 🚀 Công nghệ sử dụng

**Backend (Microservices):**
- **Node.js & Express.js:** Nền tảng xây dựng các dịch vụ microservice API (Product, User, Order, Inventory, Payment).
- **MongoDB & Mongoose:** Cơ sở dữ liệu NoSQL lưu trữ dữ liệu sản phẩm, người dùng, đơn hàng.
- **Redis:** In-memory store để caching sản phẩm và tăng tốc độ truy vấn.
- **RabbitMQ:** Message Broker để xử lý các tác vụ bất đồng bộ giữa các service (ví dụ: giao tiếp giữa dịch vụ thanh toán và kho hàng khi có đơn hàng mới).
- **JWT (JSON Web Token):** Xác thực người dùng và phân quyền (Auth Middleware).
- **Docker & Docker Compose:** Container hóa tất cả các service và hạ tầng (infrastructure), giúp dễ dàng chạy toàn bộ hệ thống bằng một lệnh duy nhất.
- **http-proxy-middleware:** Sử dụng cho API Gateway để điều hướng request tới từng service độc lập.

**Frontend:**
- **React.js & Vite:** Giao diện người dùng sử dụng React Router DOM để định tuyến, kết nối qua hệ thống API Gateway (chạy qua cổng riêng biệt).

---

## 🏗️ Cấu trúc các cụm dịch vụ

Hệ thống xoay quanh 1 **API Gateway** và 5 microservices xử lý nghiệp vụ:

- `api-gateway` (:5000): Điểm tiếp nhận request từ Client, kiểm tra Authentication (JWT), forward request đến các dịch vụ bên dưới.
- `product-service` (:5001): Quản lý sản phẩm.
- `user-service` (:5005): Quản lý người dùng, xử lý Authenticate (Login/Register).
- `order-service` (:5002): Quản lý đơn hệ thống đặt hàng.
- `inventory-service`: Quản lý kho hàng (liên lạc qua message broker).
- `payment-service`: Quản lý thanh toán (liên lạc qua message broker).

---

## 🛠️ Hướng dẫn cài đặt và chạy ứng dụng

### 1. Yêu cầu trước khi chạy
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) đã được cài đặt trên máy.
- [Node.js](https://nodejs.org/en/) & npm (để chạy frontend hoặc các service thủ công nếu cần).

### 2. Thiết lập Environment Variables
Di chuyển vào thư mục `backend/` và copy file môi trường:
```bash
cd backend
cp .env.example .env
```
*(Lưu ý điền các giá trị secret JWT và URL cấu hình trong file `.env` nếu chạy production)*

### 3. Chạy hệ thống bằng Docker Compose
Tất cả backend microservices cùng với hạ tầng (MongoDB, Redis, RabbitMQ) có thể được khởi động dễ dàng thông qua Docker. Vẫn ở thư mục `backend/`, chạy lệnh sau:

```bash
# Lần đầu tiên nên dùng build
docker-compose up --build

# Nếu chỉ chạy nền (detached code), rút gọn console:
docker-compose up -d
```

Nếu muốn chỉ chạy (MongoDB, Redis, RabbitMQ) trên docker còn các service chạy thủ công thì:

```bash
# Chỉ chạy database
docker-compose up -d db redis rabbitmq

# Chạy các service thủ công
cd backend
npm run dev
```

Quá trình này sẽ chạy API Gateway ở **http://localhost:5000** và các database local cần thiết thiết.

### 4. Chạy Frontend
Mở một cửa sổ Terminal khác:
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Các đầu API chính (API Gateway)

> **Ghi chú**: Mọi request từ Client đều hướng vào API Gateway `http://localhost:5000` thay vì trỏ thẳng vào các microservices lẻ. Authentication được bảo vệ thông qua Cookie có chứa thẻ JWT.

### User API (`/api/users`)
- `POST /api/users/register` – Đăng ký người dùng mới.
- `POST /api/users/login` – Đăng nhập, trả về thẻ JWT qua HTTP-Only Cookie.
- `POST /api/users/logout` – Đăng xuất và xóa thẻ JWT.
- `GET /api/users/profile` – Lấy và xem thông tin hồ sơ của người dùng (Yêu cầu phải Đăng nhập / Gửi Cookie hợp lệ).

### Product API (`/api/products`)
- `GET /api/products` – Lấy danh sách tất cả sản phẩm (Có phân trang, search, lọc...).
- `GET /api/products/:id` – Lấy thông tin chi tiết một sản phẩm.

*(Các route admin để Tạo, Cập nhật, Xóa tài nguyên Product cũng được tích hợp nhưng yêu cầu JWT thuộc quyền Admin).*

### Order API (`/api/orders`)
- `POST /api/orders` – Gửi lên đơn hàng mới (Yêu cầu phải khai báo Authentication).
- `GET /api/orders` – Lấy và xem danh sách các đơn hàng hiện tại của hồ sơ cá nhân (Yêu cầu Authentication).

### Gateway Health Checking
- `GET /health` – Thử nghiệm kiểm tra Gateway đang live hay bị down, và trả về thông tin port của các Service liền kề.
