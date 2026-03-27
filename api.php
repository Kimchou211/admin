<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// បញ្ឈប់ការដំណើរការភ្លាម ប្រសិនបើជា OPTIONS request (CORS Preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// ១. ភ្ជាប់ទៅកាន់ Database

// ព័ត៌មានភ្ជាប់ទៅកាន់ Supabase (ផ្អែកលើ Project URL: ovkokplnskgljyvmeuib)
$host     = getenv('DB_HOST') ?: 'aws-0-ap-southeast-1.pooler.supabase.com'; // ប្រើ Pooler host បើមាន
$db_name  = getenv('DB_NAME') ?: 'postgres';
$username = getenv('DB_USER') ?: 'postgres';
$password = getenv('DB_PASSWORD');
$port     = getenv('DB_PORT') ?: '5432';

try {
    // ប្រើ pgsql driver តែមួយគត់សម្រាប់ Supabase
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$db_name", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(["error" => "ការភ្ជាប់បរាជ័យ: " . $e->getMessage()]);
    exit;
}

// ២. ទទួលទិន្នន័យពី JavaScript
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';
$data = json_decode(file_get_contents("php://input"), true);

// ៣. បែងចែកសកម្មភាពតាម Action
switch ($action) {
    // --- CUSTOMERS ---
    case 'get_customers':
        try {
            $stmt = $pdo->query("SELECT * FROM customers ORDER BY id DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (Exception $e) {
            echo json_encode(["error" => "Query Failed: " . $e->getMessage()]);
        }
        break;

    case 'save_customer':
        if (!empty($data['id'])) {
            if (!empty($data['profile_image'])) {
                $stmt = $pdo->prepare("UPDATE customers SET name=?, phone=?, address=?, profile_image=? WHERE id=?");
                $result = $stmt->execute([$data['name'], $data['phone'], $data['address'], $data['profile_image'], $data['id']]);
            } else {
                $stmt = $pdo->prepare("UPDATE customers SET name=?, phone=?, address=? WHERE id=?");
                $result = $stmt->execute([$data['name'], $data['phone'], $data['address'], $data['id']]);
            }
        } else {
            $stmt = $pdo->prepare("INSERT INTO customers (name, phone, address, profile_image) VALUES (?, ?, ?, ?)");
            $result = $stmt->execute([$data['name'], $data['phone'], $data['address'], $data['profile_image'] ?? '']);
        }
        echo json_encode(["success" => $result]);
        break;

    case 'delete_customer':
        $stmt = $pdo->prepare("DELETE FROM customers WHERE id = ?");
        $result = $stmt->execute([$_GET['id']]);
        echo json_encode(["success" => $result]);
        break;

    // --- PRODUCTS ---
    case 'get_products':
        echo json_encode($pdo->query("SELECT * FROM products ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'save_product':
        if (!empty($data['id'])) {
            $stmt = $pdo->prepare("UPDATE products SET name=?, cost_price=?, sale_price=?, quantity=? WHERE id=?");
            $result = $stmt->execute([$data['name'], $data['cost_price'], $data['sale_price'], $data['quantity'], $data['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO products (name, cost_price, sale_price, quantity) VALUES (?, ?, ?, ?)");
            $result = $stmt->execute([$data['name'], $data['cost_price'], $data['sale_price'], $data['quantity']]);
        }
        echo json_encode(["success" => $result]);
        break;

    case 'delete_product':
        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
        $result = $stmt->execute([$_GET['id']]);
        echo json_encode(["success" => $result]);
        break;

    // --- ORDERS ---
    case 'get_orders':
        $orders = $pdo->query("SELECT * FROM orders ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
        foreach($orders as &$o) {
            $stmt = $pdo->prepare("SELECT oi.*, p.name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE order_id = ?");
            $stmt->execute([$o['id']]);
            $o['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode($orders);
        break;

    case 'save_order':
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO orders (customer_id, total_amount, total_profit, order_date, note) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$data['customer_id'], $data['total'], $data['profit'], $data['date'], $data['note']]);
            $order_id = $pdo->lastInsertId();

            $itemStmt = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)");
            foreach ($data['items'] as $item) {
                $itemStmt->execute([$order_id, $item['productId'], $item['qty'], $item['price'], $item['cost']]);
                
                // កាត់ស្តុកទំនិញ
                $pdo->prepare("UPDATE products SET quantity = quantity - ? WHERE id = ?")->execute([$item['qty'], $item['productId']]);
            }

            // បញ្ចូលទៅក្នុង Transactions ស្វ័យប្រវត្តិ
            $pdo->prepare("INSERT INTO transactions (title, amount, type, category, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?)")
                ->execute(["ការលក់ #" . $order_id, $data['total'], 'income', 'ការលក់', $data['date'], $data['note']]);

            $pdo->commit();
            echo json_encode(["success" => true, "order_id" => $order_id]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => $e->getMessage()]);
        }
        break;

    case 'delete_order':
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $result = $stmt->execute([$_GET['id']]);
        echo json_encode(["success" => $result]);
        break;

    // --- TRANSACTIONS ---
    case 'get_transactions':
        echo json_encode($pdo->query("SELECT * FROM transactions ORDER BY transaction_date DESC")->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'save_transaction':
        $stmt = $pdo->prepare("INSERT INTO transactions (title, amount, type, category, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?)");
        $result = $stmt->execute([$data['title'], $data['amount'], $data['type'], $data['category'], $data['date'], $data['note']]);
        echo json_encode(["success" => $result]);
        break;

    // --- DEBTS ---
    case 'get_debts':
        echo json_encode($pdo->query("SELECT * FROM debts ORDER BY debt_date DESC")->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'save_debt':
        $stmt = $pdo->prepare("INSERT INTO debts (name, type, amount, description, debt_date) VALUES (?, ?, ?, ?, ?)");
        $result = $stmt->execute([$data['name'], $data['type'], $data['amount'], $data['description'], $data['date']]);
        echo json_encode(["success" => $result]);
        break;

    // ទាញយកទិន្នន័យមកបង្ហាញលើ Dashboard
    case 'get_dashboard_stats':
        $stats = [
            'total_customers' => $pdo->query("SELECT COUNT(*) FROM customers")->fetchColumn(),
            'total_products' => $pdo->query("SELECT COUNT(*) FROM products")->fetchColumn(),
            'total_income' => $pdo->query("SELECT SUM(amount) FROM transactions WHERE type='income'")->fetchColumn() ?: 0,
            'total_expense' => $pdo->query("SELECT SUM(amount) FROM transactions WHERE type='expense'")->fetchColumn() ?: 0
        ];
        echo json_encode($stats);
        break;

    default:
        echo json_encode(["message" => "រកមិនឃើញ Action នេះទេ!"]);
        break;
}
?>
