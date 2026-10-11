cmake_minimum_required(VERSION 3.20)
project(medical_vent_twin_native_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(native-physiology STATIC
  src/shimayoshi_dynamic_acidosis.cpp
)
target_include_directories(native-physiology PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)
target_compile_options(native-physiology PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)

add_executable(medical-vent-twin-native
  src/main.cpp
)
target_link_libraries(medical-vent-twin-native PRIVATE native-physiology)

add_executable(native-acidosis-selftest
  tests/dynamic_acidosis_test.cpp
)
target_link_libraries(native-acidosis-selftest PRIVATE native-physiology)

if(APPLE)
  target_compile_definitions(medical-vent-twin-native PRIVATE PLATFORM_MACOS=1)
  target_compile_definitions(native-acidosis-selftest PRIVATE PLATFORM_MACOS=1)
endif()

target_compile_options(medical-vent-twin-native PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)
target_compile_options(native-acidosis-selftest PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)

enable_testing()
add_test(NAME native-acidosis-selftest COMMAND native-acidosis-selftest)
