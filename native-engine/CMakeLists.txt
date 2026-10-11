cmake_minimum_required(VERSION 3.20)
project(medical_vent_twin_native_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(medical-vent-twin-native
  src/main.cpp
)

if(APPLE)
  target_compile_definitions(medical-vent-twin-native PRIVATE PLATFORM_MACOS=1)
endif()

target_compile_options(medical-vent-twin-native PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)
