#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cerrno>
#include <csignal>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

namespace {

volatile std::sig_atomic_t g_stop = 0;

void on_signal(int) {
  g_stop = 1;
}

std::string getenv_or(const char* key, const char* fallback) {
  const char* value = std::getenv(key);
  return (value && *value) ? std::string(value) : std::string(fallback);
}

int parse_port(const std::string& raw) {
  const int value = std::stoi(raw);
  if (value < 1 || value > 65535) {
    throw std::runtime_error("NATIVE_ENGINE_PORT must be 1..65535");
  }
  return value;
}

void send_all(int fd, const std::string& data) {
  std::size_t sent = 0;
  while (sent < data.size()) {
    const ssize_t n = ::send(fd, data.data() + sent, data.size() - sent, 0);
    if (n < 0) {
      if (errno == EINTR) continue;
      return;
    }
    sent += static_cast<std::size_t>(n);
  }
}

std::string http_response(int status,
                          const std::string& status_text,
                          const std::string& content_type,
                          const std::string& body,
                          const std::string& cors_origin) {
  std::ostringstream out;
  out << "HTTP/1.1 " << status << " " << status_text << "\r\n"
      << "Content-Type: " << content_type << "\r\n"
      << "Content-Length: " << body.size() << "\r\n"
      << "Cache-Control: no-store\r\n";
  if (!cors_origin.empty()) {
    out << "Access-Control-Allow-Origin: " << cors_origin << "\r\n"
        << "Vary: Origin\r\n";
  }
  out << "Connection: close\r\n\r\n"
      << body;
  return out.str();
}

std::string health_json(const std::string& bind_host, int port) {
  std::ostringstream out;
  out << "{"
      << "\"status\":\"ok\","
      << "\"service\":\"medical-vent-twin-native\","
      << "\"schema\":\"native-engine-health/v1\","
      << "\"bindHost\":\"" << bind_host << "\","
      << "\"port\":" << port << ","
      << "\"physiologyAuthority\":false,"
      << "\"controlAuthority\":false,"
      << "\"message\":\"Native engine boundary is running; physiology remains browser-authoritative.\""
      << "}";
  return out.str();
}

std::string state_json() {
  return "{"
    "\"schema\":\"native-engine-state/v1\","
    "\"status\":\"boundary-only\","
    "\"physiologyAuthority\":false,"
    "\"controlAuthority\":false,"
    "\"patientState\":null,"
    "\"bedside\":{"
      "\"heartRatePerMin\":null,"
      "\"meanArterialPressureMmHg\":null,"
      "\"cardiacOutputLPerMin\":null,"
      "\"strokeVolumeMl\":null,"
      "\"systemicVascularResistanceMmHgMinPerL\":null,"
      "\"pulmonaryVascularResistanceMmHgMinPerL\":null,"
      "\"arterialPo2MmHg\":null,"
      "\"arterialPco2MmHg\":null,"
      "\"arterialPh\":null,"
      "\"arrestState\":null"
    "},"
    "\"message\":\"Native state contract is live, but no browser physiology has been migrated yet.\""
  "}";
}

std::string request_path(const std::string& request) {
  const std::size_t first_space = request.find(' ');
  if (first_space == std::string::npos) return "/";
  const std::size_t second_space = request.find(' ', first_space + 1);
  if (second_space == std::string::npos) return "/";
  return request.substr(first_space + 1, second_space - first_space - 1);
}

}  // namespace

int main() {
  std::signal(SIGINT, on_signal);
  std::signal(SIGTERM, on_signal);

  const std::string bind_host = getenv_or("NATIVE_ENGINE_BIND", "127.0.0.1");
  const int port = parse_port(getenv_or("NATIVE_ENGINE_PORT", "8771"));
  const std::string cors_origin = getenv_or("NATIVE_ENGINE_CORS_ORIGIN", "");

  const int server_fd = ::socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) {
    std::cerr << "socket failed: " << std::strerror(errno) << "\n";
    return 1;
  }

  int reuse = 1;
  ::setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(static_cast<uint16_t>(port));
  if (::inet_pton(AF_INET, bind_host.c_str(), &address.sin_addr) != 1) {
    std::cerr << "invalid NATIVE_ENGINE_BIND IPv4 address: " << bind_host << "\n";
    ::close(server_fd);
    return 1;
  }

  if (::bind(server_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
    std::cerr << "bind failed: " << std::strerror(errno) << "\n";
    ::close(server_fd);
    return 1;
  }

  if (::listen(server_fd, 16) < 0) {
    std::cerr << "listen failed: " << std::strerror(errno) << "\n";
    ::close(server_fd);
    return 1;
  }

  std::cout << "medical-vent-twin-native listening on http://"
            << bind_host << ":" << port << "\n";
  std::cout << "physiology authority: false\n";
  std::cout.flush();

  while (!g_stop) {
    sockaddr_in client{};
    socklen_t len = sizeof(client);
    const int client_fd =
        ::accept(server_fd, reinterpret_cast<sockaddr*>(&client), &len);
    if (client_fd < 0) {
      if (errno == EINTR) continue;
      std::cerr << "accept failed: " << std::strerror(errno) << "\n";
      break;
    }

    char buffer[4096];
    const ssize_t n = ::recv(client_fd, buffer, sizeof(buffer) - 1, 0);
    if (n > 0) {
      buffer[n] = '\0';
      const std::string request(buffer);
      const std::string path = request_path(request);

      if (request.rfind("GET ", 0) != 0) {
        send_all(client_fd, http_response(
          405, "Method Not Allowed", "application/json",
          "{\"error\":\"only GET is implemented in boundary prototype\"}",
          cors_origin
        ));
      } else if (path == "/health") {
        send_all(client_fd, http_response(
          200, "OK", "application/json", health_json(bind_host, port),
          cors_origin
        ));
      } else if (path == "/state") {
        send_all(client_fd, http_response(
          200, "OK", "application/json", state_json(),
          cors_origin
        ));
      } else {
        send_all(client_fd, http_response(
          404, "Not Found", "application/json",
          "{\"error\":\"not found\"}",
          cors_origin
        ));
      }
    }

    ::close(client_fd);
  }

  ::close(server_fd);
  return 0;
}
