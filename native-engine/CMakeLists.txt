cmake_minimum_required(VERSION 3.20)
project(medical_vent_twin_native_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(native-physiology STATIC
  src/shimayoshi_dynamic_acidosis.cpp
  src/shimayoshi_hummod_co2_bridge.cpp
  src/kato_utaki_lv_bridge.cpp
  src/shimayoshi_hummod_dynamic_acidosis_pressure_shadow.cpp
  src/native_diagnostics.cpp
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

add_executable(native-myocardial-bridge-selftest
  tests/myocardial_bridge_test.cpp
)
target_link_libraries(native-myocardial-bridge-selftest PRIVATE native-physiology)

add_executable(native-acidosis-pressure-shadow-selftest
  tests/dynamic_acidosis_pressure_shadow_test.cpp
)
target_link_libraries(native-acidosis-pressure-shadow-selftest PRIVATE native-physiology)

add_executable(native-diagnostics-selftest
  tests/native_diagnostics_test.cpp
)
target_link_libraries(native-diagnostics-selftest PRIVATE native-physiology)

if(APPLE)
  target_compile_definitions(medical-vent-twin-native PRIVATE PLATFORM_MACOS=1)
  target_compile_definitions(native-acidosis-selftest PRIVATE PLATFORM_MACOS=1)
  target_compile_definitions(native-myocardial-bridge-selftest PRIVATE PLATFORM_MACOS=1)
  target_compile_definitions(native-acidosis-pressure-shadow-selftest PRIVATE PLATFORM_MACOS=1)
  target_compile_definitions(native-diagnostics-selftest PRIVATE PLATFORM_MACOS=1)
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
target_compile_options(native-myocardial-bridge-selftest PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)
target_compile_options(native-acidosis-pressure-shadow-selftest PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)
target_compile_options(native-diagnostics-selftest PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)

enable_testing()
add_test(NAME native-acidosis-selftest COMMAND native-acidosis-selftest)
add_test(NAME native-myocardial-bridge-selftest COMMAND native-myocardial-bridge-selftest)
add_test(NAME native-acidosis-pressure-shadow-selftest COMMAND native-acidosis-pressure-shadow-selftest)
add_test(NAME native-diagnostics-selftest COMMAND native-diagnostics-selftest)
